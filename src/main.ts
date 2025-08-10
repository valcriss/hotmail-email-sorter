import 'dotenv/config';
import { MicrosoftGraphClient, type GraphEmail } from './graph.js';
import { classifyEmail, type Decision } from './llm.js';
import { logger } from './logger.js';

const DRY = process.env.DRY_RUN === '1';
const SORT_MODE = process.env.SORT_MODE === '1';
const EMAIL_LIMIT = parseInt(process.env.EMAIL_LIMIT || '20', 10);

async function run() {
  if (SORT_MODE) {
    logger.progress('Starting sorting of existing emails');
    logger.info('=====================================\n');
  } else {
    logger.progress('Starting Hotmail email sorter');
    logger.info('=============================\n');
  }

  // Initialize Microsoft Graph client
  const graphClient = new MicrosoftGraphClient();
  
  try {
    // Authentication
    logger.auth('Microsoft authentication...');
    await graphClient.authenticate();
    
    let emails: GraphEmail[];
    
    if (SORT_MODE) {
      logger.info(`\n📂 Retrieving emails from inbox (all emails, max ${EMAIL_LIMIT})...`);
      emails = await graphClient.getAllInboxEmails(EMAIL_LIMIT);
      logger.stats(`${emails.length} emails found in inbox (read and unread)\n`);
      
      if (emails.length === 0) {
        logger.success('No emails to sort!');
        logger.goodbye('Closing program...\n');
        process.exit(0);
      }
      
    } else {
      logger.info(`\n📬 Retrieving unread emails from inbox (max ${EMAIL_LIMIT})...`);
      emails = await graphClient.getUnreadEmails(EMAIL_LIMIT);
      logger.stats(`${emails.length} unread emails found in inbox\n`);
      
      if (emails.length === 0) {
        logger.success('No emails to process!');
        logger.goodbye('Closing program...\n');
        process.exit(0);
      }
    }

    // Process each email
    for (const email of emails) {
      const from = email.from?.emailAddress?.address || 'Unknown sender';
      const subject = email.subject || 'No subject';
      const preview = email.bodyPreview || '';
      
      // Extract full HTML/text content for better classification
      const fullContent = MicrosoftGraphClient.convertEmailBodyToText(email);

      const statusIcon = email.isRead ? '📖' : '📧';
      logger.info(`\n${statusIcon} [${email.id.slice(-8)}] ${subject}`);
      logger.debug(`   👤 From: ${from}`);
      logger.debug(`   📄 Preview: ${preview.slice(0, 100)}...`);
      logger.debug(`   📝 Content: ${fullContent.length} characters extracted`);

      try {
        // AI classification with full content
        const decision: Decision = await classifyEmail({ from, subject, content: fullContent });
        logger.robot(`Decision:`, decision);

        if (DRY) {
          logger.debug(`   🔍 TEST MODE - No action performed`);
          continue;
        }

        // Apply decision
        await applyDecision(graphClient, email, decision);
        logger.success(`   Action applied`);

      } catch (error) {
        logger.error(`   Error during processing:`, error);
      }
    }

    // Final summary and exit
    logger.success('\n🎯 Processing completed!');
    logger.stats(`Total: ${emails.length} emails processed`);
    logger.goodbye('Closing program...\n');
    
    // Clean program exit
    process.exit(0);

  } catch (error) {
    logger.error('Main error:', error);
    
    if (error instanceof Error && error.message?.includes('client_id')) {
      logger.info('\n💡 Configuration required:');
      logger.info('1. Go to https://portal.azure.com');
      logger.info('2. App registrations > New registration');
      logger.info('3. Copy Client ID to MICROSOFT_CLIENT_ID');
      logger.info('4. Configure Mail.Read and Mail.ReadWrite permissions');
    }
  }
}

async function applyDecision(client: MicrosoftGraphClient, email: GraphEmail, decision: Decision) {
  try {
    // Check if email still exists before processing
    const emailExists = await client.emailExists(email.id);
    if (!emailExists) {
      logger.warn(`Email ${email.id.slice(-8)} no longer exists, probably already processed`);
      return;
    }

    if (decision.action === 'move' && decision.folder) {
      const folderId = await client.ensureFolder(decision.folder);
      await client.moveEmail(email.id, folderId);
      // Note: No need to markAsRead after move as email is already processed
    } else if (decision.action === 'mark_read') {
      await client.markAsRead(email.id);
    } else if (decision.action === 'archive') {
      const archiveFolderId = await client.ensureFolder('Archive');
      await client.moveEmail(email.id, archiveFolderId);
      // Note: No need to markAsRead after move as email is already processed
    }
    // 'ignore': do nothing
  } catch (error: any) {
    if (error?.code === 'ErrorItemNotFound') {
      logger.warn(`Email ${email.id.slice(-8)} not found when applying decision (maybe already processed)`);
      return;
    }
    logger.error(`Error applying decision for ${email.id.slice(-8)}:`, error?.message || error);
    throw error;
  }
}

// Clean shutdown handling
process.on('SIGINT', () => {
  logger.goodbye('\n\nStopping program...');
  process.exit(0);
});

run().catch(err => {
  logger.error('\n💥 Fatal error:', err);
  process.exit(1);
});

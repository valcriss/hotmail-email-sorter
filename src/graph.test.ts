process.env.MICROSOFT_CLIENT_ID = 'test-client-id';
process.env.LOG_LEVEL = 'debug';
import { MicrosoftGraphClient } from './graph';
import { logger } from './logger';

const baseEmail = {
  id: '1',
  subject: 'subject',
  from: { emailAddress: { address: 'a@b.com', name: 'A' } },
  bodyPreview: '',
  isRead: false,
  parentFolderId: 'folder',
};

describe('convertEmailBodyToText', () => {
  it('converts HTML body to text', () => {
    const email = {
      ...baseEmail,
      body: { contentType: 'html', content: '<p>Hello <b>World</b></p>' },
    } as any;
    const result = MicrosoftGraphClient.convertEmailBodyToText(email);
    expect(result).toContain('Hello World');
  });

  it('returns bodyPreview when body content missing', () => {
    const email = {
      ...baseEmail,
      bodyPreview: 'Preview text',
      body: { contentType: 'html', content: '' },
    } as any;
    const result = MicrosoftGraphClient.convertEmailBodyToText(email);
    expect(result).toBe('Preview text');
  });

  it('limits plain text body to 2000 characters', () => {
    const longText = 'a'.repeat(2100);
    const email = {
      ...baseEmail,
      body: { contentType: 'text', content: longText },
    } as any;
    const result = MicrosoftGraphClient.convertEmailBodyToText(email);
    expect(result.length).toBe(2000);
  });
});

describe('startLocalServer', () => {
  it('clears security timeout after successful authentication', async () => {
    const client = new MicrosoftGraphClient();
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    const port = 4567;
    const serverPromise = (client as any).startLocalServer(port, 100); // 100ms timeout for test

    // Ensure server is ready before sending the request
    await new Promise(resolve => setImmediate(resolve));

    await fetch(`http://localhost:${port}/callback?code=testcode`);
    const code = await serverPromise;
    expect(code).toBe('testcode');

    // Wait longer than the timeout to ensure it would have fired if not cleared
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe('moveEmail', () => {
  it('logs warning when email stays in same folder', async () => {
    const client = new MicrosoftGraphClient();
    const mockPost = jest.fn().mockResolvedValue({ id: '1', parentFolderId: 'source' });
    (client as any).graphClient = {
      api: () => ({ post: mockPost })
    };
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    await client.moveEmail('1', 'dest', 'source');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('logs debug when email moves to a different folder', async () => {
    const client = new MicrosoftGraphClient();
    const mockPost = jest.fn().mockResolvedValue({ id: '1', parentFolderId: 'dest' });
    (client as any).graphClient = {
      api: () => ({ post: mockPost })
    };
    const debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
    await client.moveEmail('1', 'dest', 'source');
    expect(debugSpy).toHaveBeenCalled();
    debugSpy.mockRestore();
  });
});

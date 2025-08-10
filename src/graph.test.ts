import { MicrosoftGraphClient } from './graph';

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

import { classifyEmail } from './llm';

describe('classifyEmail action validation', () => {
  const baseResponse = {
    category: 'Orders',
    folder: 'Orders',
    confidence: 0.9,
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('defaults unknown action to ignore', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          response: JSON.stringify({ ...baseResponse, action: 'delete' }),
        }),
      })
    ) as any;

    const decision = await classifyEmail({ from: '', subject: '', content: '' });
    expect(decision.action).toBe('ignore');
  });

  test('accepts valid action', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          response: JSON.stringify({ ...baseResponse, action: 'move' }),
        }),
      })
    ) as any;

    const decision = await classifyEmail({ from: '', subject: '', content: '' });
    expect(decision.action).toBe('move');
  });
});

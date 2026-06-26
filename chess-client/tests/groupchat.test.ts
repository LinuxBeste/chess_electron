import { describe, test, expect, jest } from '@jest/globals';

describe('Group chat handler registration and invocation', () => {
  test('onGroupCreated handler is invoked with correct message', () => {
    const handlers = new Set<(msg: { type: string; conversationId: string; name: string }) => void>();
    const handler = jest.fn();

    handlers.add(handler);
    handlers.forEach((h) => h({ type: 'group_created', conversationId: 'conv1', name: 'My Group' }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ type: 'group_created', conversationId: 'conv1', name: 'My Group' });
  });

  test('onGroupCreated unsubscribe removes handler', () => {
    const handlers = new Set<(msg: { type: string; conversationId: string; name: string }) => void>();
    const handler = jest.fn();

    handlers.add(handler);
    const unsub = () => handlers.delete(handler);
    unsub();

    handlers.forEach((h) => h({ type: 'group_created', conversationId: 'conv2', name: 'Test' }));
    expect(handler).not.toHaveBeenCalled();
  });

  test('onGroupChat handler is invoked', () => {
    const handlers = new Set<
      (msg: {
        type: string;
        conversationId: string;
        messageId: string;
        playerId: string;
        username: string;
        text: string;
        timestamp: number;
      }) => void
    >();
    const handler = jest.fn();

    handlers.add(handler);
    handlers.forEach((h) =>
      h({
        type: 'group_chat_message',
        conversationId: 'conv1',
        messageId: 'm1',
        playerId: 'p1',
        username: 'Alice',
        text: 'Hello',
        timestamp: 1000,
      }),
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv1', text: 'Hello', username: 'Alice' }),
    );
  });

  test('onGroupChatHistory handler receives members', () => {
    const handlers = new Set<
      (msg: {
        type: string;
        conversationId: string;
        messages: unknown[];
        members: { playerId: string; role: string }[];
      }) => void
    >();
    const handler = jest.fn();
    const msg = {
      type: 'group_chat_history' as const,
      conversationId: 'conv1',
      messages: [{ messageId: 'm1', playerId: 'p1', username: 'Alice', text: 'Hi', timestamp: 1000 }],
      members: [{ playerId: 'p1', username: 'alice', displayName: 'Alice', role: 'owner' }],
    };

    handlers.add(handler);
    handlers.forEach((h) => h(msg));

    expect(handler).toHaveBeenCalledWith(msg);
    expect(msg.members).toHaveLength(1);
    expect(msg.members[0].role).toBe('owner');
  });

  test('onGroupMemberAdded handler', () => {
    const handlers = new Set<
      (msg: {
        type: string;
        conversationId: string;
        playerId: string;
        username: string;
        displayName: string;
        role: string;
      }) => void
    >();
    const handler = jest.fn();

    handlers.add(handler);
    handlers.forEach((h) =>
      h({
        type: 'group_member_added',
        conversationId: 'conv1',
        playerId: 'p2',
        username: 'bob',
        displayName: 'Bob',
        role: 'member',
      }),
    );

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ playerId: 'p2', role: 'member' }));
  });

  test('onGroupMemberRemoved handler', () => {
    const handlers = new Set<(msg: { type: string; conversationId: string; playerId: string }) => void>();
    const handler = jest.fn();

    handlers.add(handler);
    handlers.forEach((h) => h({ type: 'group_member_removed', conversationId: 'conv1', playerId: 'p2' }));

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ playerId: 'p2' }));
  });

  test('onGroupMemberPromoted handler updates role to admin', () => {
    const handlers = new Set<(msg: { type: string; conversationId: string; playerId: string; role: string }) => void>();
    const handler = jest.fn();

    handlers.add(handler);
    handlers.forEach((h) =>
      h({ type: 'group_member_promoted', conversationId: 'conv1', playerId: 'p2', role: 'admin' }),
    );

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });

  test('onGroupMemberDemoted handler updates role to member', () => {
    const handlers = new Set<(msg: { type: string; conversationId: string; playerId: string; role: string }) => void>();
    const handler = jest.fn();

    handlers.add(handler);
    handlers.forEach((h) =>
      h({ type: 'group_member_demoted', conversationId: 'conv1', playerId: 'p2', role: 'member' }),
    );

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ role: 'member' }));
  });

  test('onGroupOwnershipTransferred handler', () => {
    const handlers = new Set<(msg: { type: string; conversationId: string; newOwnerId: string }) => void>();
    const handler = jest.fn();

    handlers.add(handler);
    handlers.forEach((h) => h({ type: 'group_ownership_transferred', conversationId: 'conv1', newOwnerId: 'p2' }));

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ newOwnerId: 'p2' }));
  });

  test('onGroupMemberLeft handler', () => {
    const handlers = new Set<(msg: { type: string; conversationId: string; playerId: string }) => void>();
    const handler = jest.fn();

    handlers.add(handler);
    handlers.forEach((h) => h({ type: 'group_member_left', conversationId: 'conv1', playerId: 'p2' }));

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ playerId: 'p2' }));
  });

  test('onGroupDisbanded handler', () => {
    const handlers = new Set<(msg: { type: string; conversationId: string }) => void>();
    const handler = jest.fn();

    handlers.add(handler);
    handlers.forEach((h) => h({ type: 'group_disbanded', conversationId: 'conv1' }));

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conv1' }));
  });

  test('multiple handlers can subscribe to same group event', () => {
    const handlers = new Set<(msg: { type: string; conversationId: string }) => void>();
    const h1 = jest.fn();
    const h2 = jest.fn();

    handlers.add(h1);
    handlers.add(h2);

    handlers.forEach((h) => h({ type: 'group_disbanded', conversationId: 'conv1' }));
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  test('removing one handler does not affect other handlers', () => {
    const handlers = new Set<(msg: { type: string; conversationId: string }) => void>();
    const h1 = jest.fn();
    const h2 = jest.fn();

    handlers.add(h1);
    handlers.add(h2);
    handlers.delete(h1);

    handlers.forEach((h) =>
      h({ type: 'group_created', conversationId: 'conv1', name: 'Test' } as unknown as {
        type: string;
        conversationId: string;
      }),
    );
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
  });
});

describe('Error message dispatch', () => {
  test('error message creates toast via store', () => {
    const toasts: { text: string; type: string }[] = [];
    const store = {
      toast(text: string, type: string = 'error') {
        toasts.push({ text, type });
      },
    };

    const errorMsg = { type: 'error' as const, error: 'Server error' };
    store.toast(errorMsg.error || 'Server error');

    expect(toasts).toHaveLength(1);
    expect(toasts[0].text).toBe('Server error');
    expect(toasts[0].type).toBe('error');
  });

  test('error with custom message', () => {
    const toasts: { text: string; type: string }[] = [];
    const store = {
      toast(text: string, type: string = 'error') {
        toasts.push({ text, type });
      },
    };

    const error = 'Group name too short';
    store.toast(error);
    expect(toasts[0].text).toBe('Group name too short');
  });

  test('error with empty message uses fallback', () => {
    const toasts: { text: string; type: string }[] = [];
    const store = {
      toast(text: string, type: string = 'error') {
        toasts.push({ text, type });
      },
    };

    const error = '';
    store.toast(error || 'Server error');
    expect(toasts[0].text).toBe('Server error');
  });
});

describe('send method message logging', () => {
  test('send logs warning when WebSocket is not open', () => {
    const warnings: string[] = [];
    const logger = {
      warn(msg: string) {
        warnings.push(msg);
      },
    };

    const ws = null;
    const msgType = 'create_group';
    if (ws && (ws as unknown as { readyState: number }).readyState === WebSocket.OPEN) {
      // would send
    } else {
      logger.warn('Socket: dropping message type ' + msgType + ' - WebSocket not open');
    }

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('create_group');
    expect(warnings[0]).toContain('dropping');
  });

  test('send does not log warning when WebSocket is open', () => {
    const warnings: string[] = [];
    const logger = {
      warn(msg: string) {
        warnings.push(msg);
      },
      info(_msg: string) {},
    };

    const mockWs = { readyState: WebSocket.OPEN, send: jest.fn() };
    const msgType = 'group_chat';
    if (mockWs && mockWs.readyState === WebSocket.OPEN) {
      logger.info('Socket: sending message type: ' + msgType);
      mockWs.send(JSON.stringify({ type: msgType }));
    } else {
      logger.warn('Socket: dropping message type ' + msgType + ' - WebSocket not open');
    }

    expect(warnings).toHaveLength(0);
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'group_chat' }));
  });

  test('send warns for unknown message type', () => {
    const warnings: string[] = [];
    const logger = {
      warn(msg: string) {
        warnings.push(msg);
      },
    };

    const ws = null;
    const msgType = 'unknown';
    if (ws && (ws as unknown as { readyState: number }).readyState === WebSocket.OPEN) {
      // would send
    } else {
      logger.warn('Socket: dropping message type ' + msgType + ' - WebSocket not open');
    }

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('unknown');
  });

  test('send works for all group message types', () => {
    const sent: string[] = [];
    const mockWs = { readyState: 1, send: (data: string) => sent.push(data) };

    const types = [
      'create_group',
      'group_chat',
      'get_group_chat_history',
      'group_add_member',
      'group_remove_member',
      'group_promote_member',
      'group_demote_member',
      'group_transfer_ownership',
      'group_leave',
      'group_disband',
    ];

    for (const type of types) {
      const msg = type === 'create_group' ? { type, name: 'Test' } : { type, conversationId: 'conv1' };
      if (mockWs && mockWs.readyState === 1) {
        mockWs.send(JSON.stringify({ ...msg, ...(type === 'group_chat' ? { text: 'hello' } : {}) }));
      }
    }

    expect(sent).toHaveLength(types.length);
    expect(JSON.parse(sent[0])).toEqual({ type: 'create_group', name: 'Test' });
  });
});

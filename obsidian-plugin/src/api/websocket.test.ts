/**
 * Unit tests for WebSocket Connection Manager
 */

import { WebSocketManager, WebSocketState } from './websocket';
import { EventEmitter } from 'events';

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  readyState: number = 0;
  url: string;
  
  constructor(url: string) {
    super();
    this.url = url;
    setTimeout(() => {
      this.readyState = 1;
      this.emit('open');
    }, 10);
  }
  
  send(data: string): void {
    // Mock send
  }
  
  close(code?: number, reason?: string): void {
    this.readyState = 3;
    this.emit('close', { code, reason });
  }
  
  addEventListener(event: string, handler: Function): void {
    this.on(event, handler);
  }
  
  removeEventListener(event: string, handler: Function): void {
    this.off(event, handler);
  }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('WebSocketManager', () => {
  let manager: WebSocketManager;
  
  beforeEach(() => {
    manager = new WebSocketManager({
      url: 'ws://localhost:3000',
      reconnect: true,
      reconnectDelay: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000,
      debug: false,
    });
  });
  
  afterEach(() => {
    manager.disconnect();
  });
  
  describe('Connection Management', () => {
    it('should connect to WebSocket server', async () => {
      const connectPromise = manager.connect();
      expect(manager.getState()).toBe(WebSocketState.CONNECTING);
      
      await connectPromise;
      expect(manager.getState()).toBe(WebSocketState.OPEN);
      expect(manager.isConnected()).toBe(true);
    });
    
    it('should handle connection errors', async () => {
      // Override MockWebSocket to simulate error
      const originalWebSocket = (global as any).WebSocket;
      (global as any).WebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            this.emit('error', new Error('Connection failed'));
            this.emit('close', { code: 1006, reason: 'Connection failed' });
          }, 10);
        }
      };
      
      try {
        await manager.connect();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // Restore original
      (global as any).WebSocket = originalWebSocket;
    });
    
    it('should disconnect cleanly', async () => {
      await manager.connect();
      expect(manager.isConnected()).toBe(true);
      
      manager.disconnect();
      expect(manager.getState()).toBe(WebSocketState.CLOSED);
      expect(manager.isConnected()).toBe(false);
    });
  });
  
  describe('Message Handling', () => {
    beforeEach(async () => {
      await manager.connect();
    });
    
    it('should send messages when connected', () => {
      const message = {
        type: 'test',
        data: { foo: 'bar' },
        timestamp: new Date().toISOString(),
      };
      
      expect(() => manager.send(message)).not.toThrow();
    });
    
    it('should queue messages when not connected', () => {
      manager.disconnect();
      
      const message = {
        type: 'test',
        data: { foo: 'bar' },
        timestamp: new Date().toISOString(),
      };
      
      manager.send(message);
      const stats = manager.getStats();
      expect(stats.queuedMessages).toBe(1);
    });
    
    it('should handle incoming messages', (done) => {
      manager.on('message', (message) => {
        expect(message.type).toBe('test');
        expect(message.data).toEqual({ foo: 'bar' });
        done();
      });
      
      // Simulate incoming message
      const ws = (manager as any).ws as MockWebSocket;
      ws.emit('message', {
        data: JSON.stringify({
          type: 'test',
          data: { foo: 'bar' },
        }),
      });
    });
    
    it('should handle task:new events', (done) => {
      manager.on('task:new', (task) => {
        expect(task.description).toBe('Test task');
        done();
      });
      
      const ws = (manager as any).ws as MockWebSocket;
      ws.emit('message', {
        data: JSON.stringify({
          type: 'task:new',
          data: {
            task: {
              description: 'Test task',
              priority: 'high',
              confidence: 0.9,
            },
          },
        }),
      });
    });
    
    it('should handle meeting:processed events', (done) => {
      manager.on('meeting:processed', (meeting) => {
        expect(meeting.title).toBe('Test Meeting');
        done();
      });
      
      const ws = (manager as any).ws as MockWebSocket;
      ws.emit('message', {
        data: JSON.stringify({
          type: 'meeting:processed',
          data: {
            meeting: {
              id: 'test-123',
              title: 'Test Meeting',
              date: new Date().toISOString(),
              participants: [],
              tasks: [],
            },
          },
        }),
      });
    });
  });
  
  describe('Subscription Management', () => {
    beforeEach(async () => {
      await manager.connect();
    });
    
    it('should subscribe to topics', () => {
      manager.subscribe('meetings');
      const stats = manager.getStats();
      expect(stats.subscriptions).toContain('meetings');
    });
    
    it('should unsubscribe from topics', () => {
      manager.subscribe('meetings');
      manager.unsubscribe('meetings');
      const stats = manager.getStats();
      expect(stats.subscriptions).not.toContain('meetings');
    });
    
    it('should resubscribe on reconnection', async () => {
      manager.subscribe('meetings');
      manager.subscribe('tasks');
      
      // Simulate disconnect and reconnect
      const ws = (manager as any).ws as MockWebSocket;
      ws.emit('close', { code: 1006, reason: 'Lost connection' });
      
      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const stats = manager.getStats();
      expect(stats.subscriptions).toContain('meetings');
      expect(stats.subscriptions).toContain('tasks');
    });
  });
  
  describe('Heartbeat/Ping-Pong', () => {
    beforeEach(async () => {
      await manager.connect();
    });
    
    it('should send ping messages periodically', (done) => {
      let pingReceived = false;
      
      const ws = (manager as any).ws as MockWebSocket;
      const originalSend = ws.send.bind(ws);
      ws.send = (data: string) => {
        const message = JSON.parse(data);
        if (message.type === 'ping') {
          pingReceived = true;
          done();
        }
        originalSend(data);
      };
      
      // Trigger heartbeat
      (manager as any).sendPing();
    });
    
    it('should handle pong messages', (done) => {
      manager.on('heartbeat', (latency) => {
        expect(latency).toBeGreaterThanOrEqual(0);
        done();
      });
      
      // Send ping first
      (manager as any).sendPing();
      
      // Simulate pong response
      const ws = (manager as any).ws as MockWebSocket;
      ws.emit('message', {
        data: JSON.stringify({ type: 'pong' }),
      });
    });
  });
  
  describe('Reconnection Logic', () => {
    it('should attempt reconnection on unexpected disconnect', (done) => {
      manager.connect().then(() => {
        let reconnectingEmitted = false;
        
        manager.on('reconnecting', (attempt, delay) => {
          expect(attempt).toBe(1);
          expect(delay).toBeGreaterThanOrEqual(100);
          reconnectingEmitted = true;
        });
        
        manager.on('connected', () => {
          if (reconnectingEmitted) {
            done();
          }
        });
        
        // Simulate unexpected disconnect
        const ws = (manager as any).ws as MockWebSocket;
        ws.emit('close', { code: 1006, reason: 'Lost connection' });
      });
    });
    
    it('should use exponential backoff for reconnection', (done) => {
      const delays: number[] = [];
      
      manager.on('reconnecting', (attempt, delay) => {
        delays.push(delay);
        
        if (attempt === 3) {
          expect(delays[0]).toBeLessThan(delays[1]);
          expect(delays[1]).toBeLessThan(delays[2]);
          done();
        }
      });
      
      // Override MockWebSocket to always fail
      (global as any).WebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            this.emit('close', { code: 1006, reason: 'Failed' });
          }, 10);
        }
      };
      
      manager.connect().catch(() => {
        // Expected to fail
      });
    });
    
    it('should stop reconnecting after max attempts', (done) => {
      let attempts = 0;
      
      manager.on('reconnecting', (attempt) => {
        attempts = attempt;
      });
      
      manager.on('reconnectFailed', () => {
        expect(attempts).toBe(3);
        done();
      });
      
      // Override MockWebSocket to always fail
      (global as any).WebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            this.emit('close', { code: 1006, reason: 'Failed' });
          }, 10);
        }
      };
      
      manager.connect().catch(() => {
        // Expected to fail
      });
    });
  });
  
  describe('State Management', () => {
    it('should track connection state correctly', async () => {
      expect(manager.getState()).toBe(WebSocketState.CLOSED);
      
      const connectPromise = manager.connect();
      expect(manager.getState()).toBe(WebSocketState.CONNECTING);
      
      await connectPromise;
      expect(manager.getState()).toBe(WebSocketState.OPEN);
      
      manager.disconnect();
      expect(manager.getState()).toBe(WebSocketState.CLOSED);
    });
    
    it('should provide connection statistics', async () => {
      await manager.connect();
      manager.subscribe('meetings');
      manager.send({ type: 'test', timestamp: new Date().toISOString() });
      
      const stats = manager.getStats();
      expect(stats.state).toBe(WebSocketState.OPEN);
      expect(stats.subscriptions).toContain('meetings');
      expect(stats.reconnectAttempts).toBe(0);
    });
  });
  
  describe('URL Management', () => {
    it('should update WebSocket URL', async () => {
      await manager.connect();
      const newUrl = 'ws://localhost:4000';
      
      let disconnected = false;
      manager.on('disconnected', () => {
        disconnected = true;
      });
      
      manager.updateUrl(newUrl);
      
      // Should trigger reconnection with new URL
      expect((manager as any).options.url).toBe(newUrl);
    });
  });
});

describe('WebSocketManager Error Handling', () => {
  let manager: WebSocketManager;
  
  beforeEach(() => {
    manager = new WebSocketManager({
      url: 'ws://localhost:3000',
      reconnect: false, // Disable for error tests
      debug: false,
    });
  });
  
  afterEach(() => {
    manager.disconnect();
  });
  
  it('should handle malformed messages', async () => {
    await manager.connect();
    
    const ws = (manager as any).ws as MockWebSocket;
    
    // Should not throw
    expect(() => {
      ws.emit('message', { data: 'invalid json' });
    }).not.toThrow();
  });
  
  it('should handle connection timeout', (done) => {
    // Override MockWebSocket to never connect
    (global as any).WebSocket = class extends EventEmitter {
      readyState = 0;
      url: string;
      
      constructor(url: string) {
        super();
        this.url = url;
        // Never emit open event
      }
      
      send(): void {}
      close(): void {}
      addEventListener(event: string, handler: Function): void {
        this.on(event, handler);
      }
    };
    
    manager.connect().catch(error => {
      expect(error).toBeDefined();
      done();
    });
    
    // Simulate timeout
    setTimeout(() => {
      const ws = (manager as any).ws;
      if (ws) {
        ws.emit('error', new Error('Timeout'));
        ws.emit('close', { code: 1006, reason: 'Timeout' });
      }
    }, 100);
  });
});
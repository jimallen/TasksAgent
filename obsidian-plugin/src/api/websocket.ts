/**
 * WebSocket Connection Manager for Meeting Tasks Plugin
 * Handles real-time updates from TasksAgent service
 */

import { Events } from 'obsidian';
import { 
  WebSocketMessage, 
  WebSocketEvent, 
  MeetingNote, 
  ExtractedTask,
  ConnectionStatus 
} from './types';
import { MeetingTasksSettings } from '../settings';

/**
 * WebSocket connection states
 */
export enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
  RECONNECTING = 4,
}

/**
 * WebSocket manager options
 */
export interface WebSocketOptions {
  url: string;
  reconnect: boolean;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  debug: boolean;
}

/**
 * WebSocket connection manager
 */
export class WebSocketManager extends Events {
  private ws: WebSocket | null = null;
  private options: WebSocketOptions;
  private state: WebSocketState = WebSocketState.CLOSED;
  private reconnectAttempts: number = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private lastPingTime: number = 0;
  private lastPongTime: number = 0;
  private subscriptions: Set<string> = new Set();
  private messageQueue: WebSocketMessage[] = [];
  private isReconnecting: boolean = false;

  constructor(options: Partial<WebSocketOptions> = {}) {
    super();
    
    this.options = {
      url: options.url || 'ws://localhost:3000',
      reconnect: options.reconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 5000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      debug: options.debug ?? false,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === WebSocketState.OPEN) {
        resolve();
        return;
      }

      if (this.state === WebSocketState.CONNECTING) {
        // Wait for existing connection attempt
        const connectedHandler = () => {
          this.off('connected', connectedHandler);
          resolve();
        };
        const errorHandler = (error: Error) => {
          this.off('error', errorHandler);
          reject(error);
        };
        this.on('connected', connectedHandler);
        this.on('error', errorHandler);
        return;
      }

      this.log('Connecting to WebSocket server:', this.options.url);
      this.state = WebSocketState.CONNECTING;
      
      try {
        this.ws = new WebSocket(this.options.url);
        
        // Set up event handlers
        this.setupEventHandlers();
        
        // Handle connection success
        this.ws.addEventListener('open', () => {
          this.onOpen();
          resolve();
        });
        
        // Handle connection error
        this.ws.addEventListener('error', (event) => {
          const error = new Error('WebSocket connection failed');
          this.onError(error);
          reject(error);
        });
        
      } catch (error) {
        this.state = WebSocketState.CLOSED;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.log('Disconnecting from WebSocket server');
    
    // Clear reconnection
    this.isReconnecting = false;
    this.clearReconnectTimer();
    
    // Clear heartbeat
    this.clearHeartbeatTimer();
    
    // Close WebSocket
    if (this.ws) {
      this.state = WebSocketState.CLOSING;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.state = WebSocketState.CLOSED;
    this.trigger('disconnected');
  }

  /**
   * Send a message to the server
   */
  send(message: WebSocketMessage): void {
    if (this.state !== WebSocketState.OPEN) {
      // Queue message if not connected
      this.messageQueue.push(message);
      this.log('Message queued (not connected):', message);
      return;
    }

    try {
      const data = JSON.stringify(message);
      this.ws?.send(data);
      this.log('Message sent:', message);
    } catch (error) {
      this.log('Failed to send message:', error);
      this.messageQueue.push(message);
    }
  }

  /**
   * Subscribe to a topic
   */
  subscribe(topic: string): void {
    this.subscriptions.add(topic);
    
    if (this.state === WebSocketState.OPEN) {
      this.send({
        type: 'subscribe',
        topic,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string): void {
    this.subscriptions.delete(topic);
    
    if (this.state === WebSocketState.OPEN) {
      this.send({
        type: 'unsubscribe',
        topic,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get current connection state
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === WebSocketState.OPEN;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.addEventListener('open', () => this.onOpen());
    this.ws.addEventListener('message', (event) => this.onMessage(event));
    this.ws.addEventListener('error', (event) => this.onError(new Error('WebSocket error')));
    this.ws.addEventListener('close', (event) => this.onClose(event));
  }

  /**
   * Handle WebSocket open event
   */
  private onOpen(): void {
    this.log('WebSocket connected');
    this.state = WebSocketState.OPEN;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Re-subscribe to topics
    this.subscriptions.forEach(topic => {
      this.send({
        type: 'subscribe',
        topic,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Send queued messages
    this.flushMessageQueue();
    
    // Emit connected event
    this.trigger('connected');
  }

  /**
   * Handle WebSocket message event
   */
  private onMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.log('Message received:', message);
      
      // Handle different message types
      switch (message.type) {
        case 'pong':
          this.handlePong();
          break;
          
        case 'task:new':
          this.handleNewTask(message);
          break;
          
        case 'meeting:processed':
          this.handleMeetingProcessed(message);
          break;
          
        case 'email:received':
          this.handleEmailReceived(message);
          break;
          
        case 'processing:started':
          this.handleProcessingStarted(message);
          break;
          
        case 'processing:completed':
          this.handleProcessingCompleted(message);
          break;
          
        case 'error':
          this.handleErrorMessage(message);
          break;
          
        case 'subscription:confirmed':
          this.handleSubscriptionConfirmed(message);
          break;
          
        default:
          this.trigger('message', message);
      }
    } catch (error) {
      this.log('Failed to parse message:', error);
    }
  }

  /**
   * Handle WebSocket error event
   */
  private onError(error: Error): void {
    this.log('WebSocket error:', error);
    this.trigger('error', error);
  }

  /**
   * Handle WebSocket close event
   */
  private onClose(event: CloseEvent): void {
    this.log('WebSocket closed:', event.code, event.reason);
    this.state = WebSocketState.CLOSED;
    this.ws = null;
    
    // Clear heartbeat
    this.clearHeartbeatTimer();
    
    // Emit disconnected event
    this.trigger('disconnected', event.code, event.reason);
    
    // Attempt reconnection if enabled
    if (this.options.reconnect && !this.isReconnecting && event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting) return;
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.log('Max reconnection attempts reached');
      this.trigger('reconnectFailed');
      return;
    }
    
    this.isReconnecting = true;
    this.state = WebSocketState.RECONNECTING;
    this.reconnectAttempts++;
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      60000 // Max 60 seconds
    );
    
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.log('Reconnection failed:', error);
        this.isReconnecting = false;
        this.scheduleReconnect();
      });
    }, delay);
    
    this.trigger('reconnecting', this.reconnectAttempts, delay);
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.clearHeartbeatTimer();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.state === WebSocketState.OPEN) {
        this.sendPing();
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Clear heartbeat timer
   */
  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send ping message
   */
  private sendPing(): void {
    this.lastPingTime = Date.now();
    this.send({
      type: 'ping',
      timestamp: new Date().toISOString(),
    });
    
    // Check for pong timeout
    setTimeout(() => {
      if (Date.now() - this.lastPongTime > this.options.heartbeatInterval * 2) {
        this.log('Heartbeat timeout - connection may be dead');
        this.ws?.close(4000, 'Heartbeat timeout');
      }
    }, 5000);
  }

  /**
   * Handle pong message
   */
  private handlePong(): void {
    this.lastPongTime = Date.now();
    const latency = this.lastPongTime - this.lastPingTime;
    this.trigger('heartbeat', latency);
  }

  /**
   * Handle new task event
   */
  private handleNewTask(message: WebSocketMessage): void {
    if (message.data?.task) {
      this.trigger('task:new', message.data.task as ExtractedTask);
    }
  }

  /**
   * Handle meeting processed event
   */
  private handleMeetingProcessed(message: WebSocketMessage): void {
    if (message.data?.meeting) {
      this.trigger('meeting:processed', message.data.meeting as MeetingNote);
    }
  }

  /**
   * Handle email received event
   */
  private handleEmailReceived(message: WebSocketMessage): void {
    if (message.data?.emailId) {
      this.trigger('email:received', message.data.emailId);
    }
  }

  /**
   * Handle processing started event
   */
  private handleProcessingStarted(message: WebSocketMessage): void {
    this.trigger('processing:started', message.data);
  }

  /**
   * Handle processing completed event
   */
  private handleProcessingCompleted(message: WebSocketMessage): void {
    this.trigger('processing:completed', message.data);
  }

  /**
   * Handle error message
   */
  private handleErrorMessage(message: WebSocketMessage): void {
    const error = new Error(message.error || 'Unknown error');
    this.trigger('error', error);
  }

  /**
   * Handle subscription confirmed
   */
  private handleSubscriptionConfirmed(message: WebSocketMessage): void {
    if (message.data?.topic) {
      this.log('Subscription confirmed:', message.data.topic);
      this.trigger('subscription:confirmed', message.data.topic);
    }
  }

  /**
   * Flush message queue
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  /**
   * Log debug message
   */
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log('[WebSocket]', ...args);
    }
  }

  /**
   * Update WebSocket URL
   */
  updateUrl(url: string): void {
    if (this.options.url !== url) {
      this.options.url = url;
      
      // Reconnect if currently connected
      if (this.state === WebSocketState.OPEN) {
        this.disconnect();
        this.connect();
      }
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    state: WebSocketState;
    reconnectAttempts: number;
    subscriptions: string[];
    queuedMessages: number;
    lastPingTime: number;
    lastPongTime: number;
  } {
    return {
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions),
      queuedMessages: this.messageQueue.length,
      lastPingTime: this.lastPingTime,
      lastPongTime: this.lastPongTime,
    };
  }
}
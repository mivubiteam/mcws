import { IncomingMessage } from 'http';
import { logger } from './logger';
import { v4 as uuidv4 } from 'uuid';

export const getClientAddress = (request: IncomingMessage): string => {
  let address = request.socket.remoteAddress;
  
  if (!address) {
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
      address = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0].trim();
      logger.log(`Used X-Forwarded-For: ${address}`);
    } else {
      address = '127.0.0.1';
      logger.log(`No remoteAddress found, defaulting to: ${address}`);
    }
  }
  
  return address;
};

export const createSubscriptionMessage = (): string => {
  return JSON.stringify({
    header: {
      version: 1,
      requestId: uuidv4(),
      messageType: 'commandRequest',
      messagePurpose: 'subscribe'
    },
    body: { eventName: 'PlayerMessage' }
  });
};
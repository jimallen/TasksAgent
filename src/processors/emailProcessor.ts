import { MeetingTranscriptAgent } from '../index';
import logger from '../utils/logger';

export interface ProcessingResult {
  emailsProcessed: number;
  tasksExtracted: number;
  notesCreated: number;
  errors: string[];
}

export class EmailProcessor {
  private agent: MeetingTranscriptAgent | null = null;

  async processEmails(quiet = false, lookbackHours?: number): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      emailsProcessed: 0,
      tasksExtracted: 0,
      notesCreated: 0,
      errors: [],
    };

    try {
      if (!this.agent) {
        this.agent = new MeetingTranscriptAgent();
        await this.agent.initialize(quiet);
      }

      const processResult = await this.agent.processEmails(quiet, lookbackHours);
      
      result.emailsProcessed = processResult.processed;
      result.tasksExtracted = processResult.tasksExtracted;
      result.notesCreated = processResult.notesCreated;
      
      logger.info(`Processing complete: ${result.emailsProcessed} emails, ${result.tasksExtracted} tasks`);
      
      return result;
    } catch (error) {
      const errorMsg = `Failed to process emails: ${error}`;
      logger.error(errorMsg);
      result.errors.push(errorMsg);
      throw error;
    }
  }
}
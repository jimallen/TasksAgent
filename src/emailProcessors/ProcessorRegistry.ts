/**
 * Processor Registry
 *
 * Manages label processors dynamically based on configuration
 * Each Gmail label gets its own processor with custom settings
 */

import { LabelProcessor, LabelProcessorConfig } from './LabelProcessor';
import { GmailMessage } from '../gmailService';

export class ProcessorRegistry {
  private processors: LabelProcessor[] = [];

  /**
   * Initialize processors from label configuration
   * @param labelConfigs Array of label configurations from settings
   */
  initializeFromConfig(labelConfigs: LabelProcessorConfig[]) {
    this.processors = [];

    for (const config of labelConfigs) {
      const processor = new LabelProcessor(config);
      this.processors.push(processor);
      console.log(`[Registry] Registered processor: ${config.label} -> ${config.folderName} (prompt: ${config.promptType || 'default'})`);
    }
  }

  /**
   * Get the appropriate processor for an email based on its labels
   * @param email The email to process
   * @returns The first matching processor, or null if none found
   */
  getProcessor(email: GmailMessage): LabelProcessor | null {
    for (const processor of this.processors) {
      if (processor.canProcess(email)) {
        return processor;
      }
    }
    return null;
  }

  /**
   * Get all registered processors
   */
  getAllProcessors(): LabelProcessor[] {
    return this.processors;
  }

  /**
   * Get processor by label name
   */
  getProcessorByLabel(label: string): LabelProcessor | null {
    return this.processors.find(p => p.label === label) || null;
  }
}

export const processorRegistry = new ProcessorRegistry();

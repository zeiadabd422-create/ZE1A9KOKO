/**
 * FlowEngine - Pure logic engine for verification flow steps
 * No Discord.js logic here - only step management
 */
export class FlowEngine {
  constructor() {
    this.steps = {
      start: {
        id: 'start',
        label: 'Start Verification',
        type: 'button',
        nextStep: 'challenge',
      },
      challenge: {
        id: 'challenge',
        label: 'Complete Challenge',
        type: 'button',
        nextStep: 'verification',
      },
      verification: {
        id: 'verification',
        label: 'Answer Question',
        type: 'modal',
        nextStep: 'complete',
      },
      complete: {
        id: 'complete',
        label: 'Verification Complete',
        type: 'final',
        nextStep: null,
      },
    };
  }

  /**
   * Get step definition
   */
  getStep(stepId) {
    return this.steps[stepId];
  }

  /**
   * Get next step
   */
  getNextStep(currentStepId) {
    const step = this.steps[currentStepId];
    if (!step || !step.nextStep) {
      return null;
    }
    return this.steps[step.nextStep];
  }

  /**
   * Validate step progression
   */
  canAdvanceToStep(currentStep, targetStep) {
    if (currentStep === targetStep) {
      return false; // Can't go to same step
    }

    const current = this.steps[currentStep];
    const target = this.steps[targetStep];

    if (!current || !target) {
      return false;
    }

    // Can only advance to next step or restart from any step
    if (targetStep === 'start') {
      return true; // Can restart
    }

    return current.nextStep === targetStep;
  }

  /**
   * Process button click logic
   */
  processButtonClick(currentStep, buttonAction) {
    const step = this.steps[currentStep];
    if (!step) throw new Error(`Invalid step: ${currentStep}`);

    if (step.type !== 'button') {
      throw new Error(`Step ${currentStep} is not a button type`);
    }

    // Validate button action
    if (!['accept', 'retry', 'cancel'].includes(buttonAction)) {
      throw new Error(`Invalid button action: ${buttonAction}`);
    }

    if (buttonAction === 'accept') {
      return { nextStep: step.nextStep, shouldAdvance: true };
    } else if (buttonAction === 'retry') {
      return { nextStep: currentStep, shouldAdvance: false };
    } else if (buttonAction === 'cancel') {
      return { nextStep: 'complete', shouldAdvance: true, cancelled: true };
    }
  }

  /**
   * Process modal submission logic
   */
  processModalSubmission(currentStep, modalData) {
    const step = this.steps[currentStep];
    if (!step) throw new Error(`Invalid step: ${currentStep}`);

    if (step.type !== 'modal') {
      throw new Error(`Step ${currentStep} is not a modal type`);
    }

    // Validate modal data exists
    if (!modalData || Object.keys(modalData).length === 0) {
      throw new Error('Modal data is empty');
    }

    // Check response length
    const responseText = Object.values(modalData)[0] || '';
    if (responseText.trim().length < 5) {
      return {
        nextStep: currentStep,
        shouldAdvance: false,
        reason: 'Response too short',
      };
    }

    return {
      nextStep: step.nextStep,
      shouldAdvance: true,
      data: modalData,
    };
  }

  /**
   * Get all available steps
   */
  getAllSteps() {
    return Object.values(this.steps);
  }

  /**
   * Check if step is final
   */
  isFinalStep(stepId) {
    const step = this.steps[stepId];
    return step && step.type === 'final';
  }
}

// Export singleton instance
export const flowEngine = new FlowEngine();

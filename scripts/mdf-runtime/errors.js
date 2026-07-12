class WorkflowError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "WorkflowError";
    this.code = code;
    this.details = details;
  }
}

function toErrorPayload(error) {
  if (error instanceof WorkflowError) {
    return { code: error.code, message: error.message, ...error.details };
  }
  return { code: "MDF_WORKFLOW_UNEXPECTED", message: error?.message || String(error) };
}

module.exports = { WorkflowError, toErrorPayload };

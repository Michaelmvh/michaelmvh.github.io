export interface UtilityCopy {
  inputLabel: string;
  outputLabel: string;
  inputHint: string;
  clearLabel: string;
  copyLabel: string;
  downloadLabel: string;
  noScriptMessage: string;
  readyMessage: string;
  updatedMessage: string;
  limitMessage: string;
  errorMessage: string;
  copiedMessage: string;
  copyErrorMessage: string;
}

export interface UrlInspectorCopy extends UtilityCopy {
  componentsHeading: string;
  schemeLabel: string;
  originLabel: string;
  hostnameLabel: string;
  portLabel: string;
  pathLabel: string;
  fragmentLabel: string;
  parametersHeading: string;
  parametersHint: string;
  parameterNameLabel: string;
  parameterValueLabel: string;
  parameterSelectLabel: string;
  trackingLabel: string;
  addLabel: string;
  selectTrackingLabel: string;
  removeSelectedLabel: string;
  invalidMessage: string;
  encodingMessage: string;
  credentialsMessage: string;
}

export interface TextUtilitiesCopy extends UtilityCopy {
  caseLabel: string;
  unchangedLabel: string;
  lowerLabel: string;
  upperLabel: string;
  capitalizeLabel: string;
  trimLabel: string;
  removeBlankLabel: string;
  deduplicateLabel: string;
  sortLabel: string;
  originalOrderLabel: string;
  ascendingLabel: string;
  descendingLabel: string;
  countMessage: string;
  updatingMessage: string;
}

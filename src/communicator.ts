/** @noSelfInFile */

import { addScriptHook, W3TS_HOOK } from "w3ts/hooks";
import { getElapsedTime, MapPlayer, Timer } from "w3ts/index";

const queue: MCCRequest[] = [];
const table: MCCRequest[] = [];
const detectCallbacks: (() => void)[] = [];

let requestBuffer = "";
let requestId = 0;
let requestIndex = 0;
let lastWriteTime = 0;
let lastReadTime = 0.001;
let mccDetected = false;

export const enum MCCState {
  NONE = 0,
  INITIALIZE = -1,
  WAITING = -2,
  DISABLED = -3,
  READ_DONE = -4
}

export const enum RequestType {
  NONE,
  HTTP
}

/**
 * The map client communicator request handler.
 */
export class MCCRequest {
  private static count = 0;

  public readonly id: number;
  public readonly from: MapPlayer;
  public readonly type: RequestType;
  public readonly payload: string;
  public readonly callback: (response: string) => void;

  constructor(from: MapPlayer, command: RequestType, payload: string, callback: (response: string) => void) {
    MCCRequest.count++;

    this.id = MCCRequest.count;
    this.from = from;
    this.type = command;
    this.payload = payload;
    this.callback = (response: string) => callback(response);

    table[this.id] = this;
    queue.push(this);
  }

  public write() {
    //print(`${this.id} ${this.type} ${this.payload}`);
    setRequestPayload(`${this.id} ${this.type} ${this.payload}`);
  }
}

/**
 * Permanently disable the MCC for the current game session.
 */
export function disableMCC() {
  setMCCState(MCCState.DISABLED);
}

/**
 * Run some code when MCC is detected for the local player.
 */
export function onMCCDetect(callback: () => void) {
  detectCallbacks.push(callback);
}

/**
 * Sets the current state of the MCC.
 */
function setMCCState(state: MCCState) {
  SetDefaultDifficulty(ConvertGameDifficulty(state));
}

/**
 * Gets the current state of the MCC.
 */
function getMCCState(): number {
  return GetHandleId(GetDefaultDifficulty());
}

/**
 * Sets the request payload to be parsed by the MCC.
 * @param payload 
 */
function setRequestPayload(payload: string) {
  SetMapDescription(payload);
}

/**
 * Sets the position of the response string that the MCC should send.
 * @param index 
 */
function setResponseIndex(index: number) {
  SetMapName(`${index}`);
}

/**
 * Converts an integer into a 4 letter string.
 */
function debugIdInteger2IdString(value: number) {
  let result = "";
  let remainingValue = value;
  let charValue: number;
  let byteno = 0;

  while (true) {

    charValue = Math.floor(remainingValue % 256);
    remainingValue = Math.floor(remainingValue / 256);
    if (charValue > 0) {
      result = result + String.fromCharCode(charValue);
    }

    byteno = byteno + 1;
    if (byteno === 4) break;

  }

  return result;
}

function processCommands() {
  const state = getMCCState();

  if (!mccDetected && state !== MCCState.INITIALIZE) {
    mccDetected = true;
    detectCallbacks.forEach((cb) => {
      cb();
    })
  }

  // write
  if (queue.length > 0 && lastReadTime > lastWriteTime) {
    lastWriteTime = getElapsedTime();
    const request = queue.shift();
    request.write();
  }

  // read
  if (state == MCCState.READ_DONE) {
    const req = table[requestId];

    if (req) {
      try {
        req.callback(requestBuffer);
      } catch (e) {
        print(`W3MCC Request #${req.id} callback failed: ${e}`);
      }
    }

    // cleanup
    requestBuffer = "";
    requestId = 0;
    requestIndex = 0;

    lastReadTime = getElapsedTime();
    setResponseIndex(0);
    setMCCState(MCCState.WAITING);
  }

  if (state > 4) {
    const chunk = debugIdInteger2IdString(state);

    requestBuffer += `${chunk}`;
    requestIndex += chunk.length;

    if (requestId === 0 && chunk.indexOf(" ") !== -1) {
      requestId = parseInt(requestBuffer.split(' ')[0]);
      requestBuffer = requestBuffer.substr(requestId.toString().length + 1);
    }

    lastReadTime = getElapsedTime();
    setResponseIndex(requestIndex);
    setMCCState(MCCState.WAITING);
  }
}

function init() {
  setMCCState(MCCState.INITIALIZE);

  new Timer().start(0.01, true, processCommands)
}

addScriptHook(W3TS_HOOK.MAIN_AFTER, init);
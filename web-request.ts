import { MapPlayer, SyncRequest } from "w3ts";
import { MCCRequest, RequestType } from "./communicator";

type WebResponse = {
  id: number,
  status: number,
  contents: string
};

export class WebRequest {
  public readonly from: MapPlayer;
  public readonly method: string;
  public readonly url: string;

  constructor(from: MapPlayer, method: string, url: string, onResponse: (response: WebResponse) => void) {
    this.from = from;
    this.method = method;
    this.url = url;

    const payload = `${this.method} ${url.replace(":", "%3A")}`;

    const req = new MCCRequest(from, RequestType.HTTP, payload, (response) => {
      const index = response.indexOf(' ');

      onResponse({
        id: req.id,
        status: parseInt(response.substr(0, index)),
        contents: response.substr(index + 1)
      });
    });
  }
}
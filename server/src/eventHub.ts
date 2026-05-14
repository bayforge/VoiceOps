import type { VoiceOpsState } from "../../shared/types.js";

type Subscriber = (state: VoiceOpsState) => void;

export class EventHub {
  private subscribers = new Set<Subscriber>();

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  publish(state: VoiceOpsState): void {
    for (const subscriber of this.subscribers) {
      subscriber(state);
    }
  }
}

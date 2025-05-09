import { AIMessage } from "@langchain/core/messages";
import { MessagesAnnotation } from "@langchain/langgraph";

export function wasImageSent(state: typeof MessagesAnnotation.State): boolean {
  const ZONE_IMAGE_TAG = "ZONAS_DISPONIBLES_IMAGE";
  return state.messages.some(
    (m) =>
      m instanceof AIMessage &&
      typeof m.content === "string" &&
      m.content.includes(ZONE_IMAGE_TAG)
  );
}

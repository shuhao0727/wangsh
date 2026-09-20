const START_TAG = "<think>";
const END_TAG = "</think>";
const DIFY_REASONING_MARKER = "<!--dify-deepseek-reasoning-->";

const VISIBLE_MARKERS = [START_TAG, DIFY_REASONING_MARKER] as const;

function indexOfIgnoreCase(value: string, needle: string): number {
  return value.toLowerCase().indexOf(needle.toLowerCase());
}

function longestMarkerPrefixSuffix(
  value: string,
  markers: readonly string[],
): number {
  const lowerValue = value.toLowerCase();
  let longest = 0;

  for (const marker of markers) {
    const lowerMarker = marker.toLowerCase();
    const maxLength = Math.min(lowerValue.length, lowerMarker.length - 1);
    for (let length = maxLength; length > longest; length -= 1) {
      if (lowerValue.endsWith(lowerMarker.slice(0, length))) {
        longest = length;
        break;
      }
    }
  }

  return longest;
}

export interface ReasoningContentFilter {
  push: (chunk: string) => string;
  finish: () => string;
  reset: () => void;
}

/**
 * Incrementally removes Dify/DeepSeek reasoning blocks without leaking partial
 * markers when an SSE boundary splits <think>, </think>, or the Dify marker.
 */
export function createReasoningContentFilter(): ReasoningContentFilter {
  let buffer = "";
  let hidden = false;
  let finished = false;

  const processVisible = (): { output: string; progressed: boolean } => {
    const startIndex = indexOfIgnoreCase(buffer, START_TAG);
    const markerIndex = indexOfIgnoreCase(buffer, DIFY_REASONING_MARKER);
    const candidates = [startIndex, markerIndex].filter((index) => index >= 0);

    if (candidates.length > 0) {
      const nextIndex = Math.min(...candidates);
      const output = buffer.slice(0, nextIndex);
      if (nextIndex === startIndex) {
        buffer = buffer.slice(nextIndex + START_TAG.length);
        hidden = true;
      } else {
        buffer = buffer.slice(nextIndex + DIFY_REASONING_MARKER.length);
      }
      return { output, progressed: true };
    }

    const pendingLength = longestMarkerPrefixSuffix(buffer, VISIBLE_MARKERS);
    const output = buffer.slice(0, buffer.length - pendingLength);
    buffer = buffer.slice(buffer.length - pendingLength);
    return { output, progressed: false };
  };

  const processHidden = (): boolean => {
    const endIndex = indexOfIgnoreCase(buffer, END_TAG);
    if (endIndex >= 0) {
      buffer = buffer.slice(endIndex + END_TAG.length);
      hidden = false;
      return true;
    }

    const pendingLength = longestMarkerPrefixSuffix(buffer, [END_TAG]);
    buffer = buffer.slice(buffer.length - pendingLength);
    return false;
  };

  return {
    push(chunk: string) {
      if (finished || !chunk) return "";
      buffer += chunk;
      let output = "";

      while (buffer) {
        if (hidden) {
          if (!processHidden()) break;
          continue;
        }

        const result = processVisible();
        output += result.output;
        if (!result.progressed) break;
      }

      return output;
    },

    finish() {
      if (finished) return "";
      finished = true;
      if (hidden) {
        buffer = "";
        return "";
      }

      // A remaining buffer that is only a prefix of a protected marker is
      // treated as an incomplete marker and fails closed.
      const pendingLength = longestMarkerPrefixSuffix(buffer, VISIBLE_MARKERS);
      const output = pendingLength === buffer.length ? "" : buffer;
      buffer = "";
      return output;
    },

    reset() {
      buffer = "";
      hidden = false;
      finished = false;
    },
  };
}

export function sanitizeReasoningContent(content: string): string {
  if (!content) return "";
  const filter = createReasoningContentFilter();
  return filter.push(content) + filter.finish();
}

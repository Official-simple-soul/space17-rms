"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "./button";

/** Moves an item one place; returns the list unchanged at either end. */
export function moveItem<T>(list: T[], index: number, by: -1 | 1): T[] {
  const target = index + by;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function RowControls({
  name,
  index,
  count,
  onMove,
  onRemove,
}: {
  name: string;
  index: number;
  count: number;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={`Move ${name} up`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={`Move ${name} down`}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
      >
        <Trash2 className="text-brand size-4" aria-hidden />
      </Button>
    </div>
  );
}

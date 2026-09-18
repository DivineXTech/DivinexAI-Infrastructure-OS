"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import type { Faq } from "@/lib/content/faqs";

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  return (
    <Accordion.Root type="single" collapsible className="flex flex-col gap-2">
      {faqs.map((faq, index) => (
        <Accordion.Item
          key={faq.question}
          value={`faq-${index}`}
          className="rounded-lg border border-border"
        >
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-medium text-ink">
              {faq.question}
              <ChevronDown className="size-4 shrink-0 text-ink-subtle transition-transform group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden px-4 pb-4 text-sm text-ink-muted data-[state=open]:animate-[slide-up_0.2s_ease-out]">
            {faq.answer}
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

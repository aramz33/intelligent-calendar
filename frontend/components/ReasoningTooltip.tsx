'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ReasoningTooltipProps {
  reasoning: string;
  children: React.ReactNode;
}

export default function ReasoningTooltip({ reasoning, children }: ReasoningTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className="relative group">
            {children}
            {/* Small indicator icon to show there's reasoning */}
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg
                className="w-3 h-3 text-white dark:text-gray-200"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="max-w-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 shadow-apple-lg"
        >
          <div className="space-y-2">
            <div className="font-semibold text-sm border-b pb-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
              Why here?
            </div>
            <div className="text-xs whitespace-pre-line text-gray-700 dark:text-gray-300 leading-relaxed">
              {reasoning}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

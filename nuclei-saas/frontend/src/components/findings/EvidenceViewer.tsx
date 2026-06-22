'use client'

import { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { FindingEvidence } from '@/types'

interface EvidenceViewerProps {
  evidence: FindingEvidence
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors bg-white/5 border border-[#1e293b] rounded px-2 py-1"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

interface CodeBlockProps {
  title: string
  content: string
  defaultExpanded?: boolean
}

function CodeBlock({ title, content, defaultExpanded = true }: CodeBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="border border-[#30363d] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {title}
        </button>
        <CopyButton text={content} />
      </div>
      {expanded && (
        <pre className="bg-[#0d1117] p-4 text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
          {content}
        </pre>
      )}
    </div>
  )
}

export function EvidenceViewer({ evidence }: EvidenceViewerProps) {
  return (
    <div className="space-y-3">
      {evidence.curl_command && (
        <CodeBlock title="cURL Command" content={evidence.curl_command} />
      )}
      {evidence.request && (
        <CodeBlock title="HTTP Request" content={evidence.request} />
      )}
      {evidence.response && (
        <CodeBlock title="HTTP Response" content={evidence.response} defaultExpanded={false} />
      )}
      {evidence.matched_at && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-amber-300 mb-1">Matched At</p>
          <code className="text-xs text-amber-200 font-mono break-all">{evidence.matched_at}</code>
        </div>
      )}
      {evidence.extracted_results && evidence.extracted_results.length > 0 && (
        <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4">
          <p className="text-xs font-semibold text-slate-300 mb-2">Extracted Results</p>
          <ul className="space-y-1">
            {evidence.extracted_results.map((r, i) => (
              <li key={i} className="text-xs text-green-400 font-mono">{r}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        {evidence.ip && <span>IP: {evidence.ip}</span>}
        <span>Timestamp: {evidence.timestamp ? new Date(evidence.timestamp).toLocaleString() : 'N/A'}</span>
      </div>
    </div>
  )
}

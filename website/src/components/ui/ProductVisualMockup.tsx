import React, { useState } from 'react';
import { Sparkles, Mic, Scan, Zap, Check, Copy } from 'lucide-react';

export const ProductVisualMockup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dsa' | 'system' | 'behavioral'>('dsa');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-700/80 shadow-2xl overflow-hidden text-slate-100 font-sans">
      {/* Window Header */}
      <div className="bg-slate-950/80 px-4 sm:px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 select-none">
        {/* Left: Window Controls & Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <img src="/logo.png" alt="Meoow Logo" className="w-5 h-5 rounded-md object-contain" />
            <span className="text-xs sm:text-sm font-bold tracking-tight text-white">Meoow AI Copilot</span>
            <span className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ● Live (~0.2s)
            </span>
          </div>
        </div>

        {/* Center: Tabs */}
        <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('dsa')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeTab === 'dsa'
                ? 'bg-brand-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DSA Problem
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeTab === 'system'
                ? 'bg-brand-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            System Design
          </button>
          <button
            onClick={() => setActiveTab('behavioral')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeTab === 'behavioral'
                ? 'bg-brand-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            STAR Behavioral
          </button>
        </div>

        {/* Right: Opacity & Shortcut Badges */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-md border border-slate-800 font-mono text-[11px]">
            <span>☀</span>
            <span>Opacity: 85%</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 border border-slate-700">Ctrl</span>
            <span>+</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 border border-slate-700">Shift</span>
            <span>+</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 border border-slate-700">H</span>
          </div>
        </div>
      </div>

      {/* Main Body Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 text-sm">
        {/* Left Side (5 Cols): Live Transcript & Audio Input */}
        <div className="lg:col-span-5 p-4 sm:p-5 bg-slate-950/40 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Mic className="w-3.5 h-3.5 text-brand-purple-400" />
              Live Transcript (Deepgram)
            </span>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Audio In-Sync
            </span>
          </div>

          {/* Transcript bubbles */}
          <div className="space-y-3">
            {activeTab === 'dsa' && (
              <>
                <div className="bg-purple-950/40 border border-purple-800/40 rounded-xl p-3">
                  <div className="flex items-center justify-between text-[11px] text-purple-300 font-medium mb-1">
                    <span>Interviewer</span>
                    <span>10:14:02 AM</span>
                  </div>
                  <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                    "We have an array of integers. Can you find the length of the longest contiguous subarray that contains at most 2 distinct numbers in O(N) time?"
                  </p>
                </div>
                <div className="bg-sky-950/40 border border-sky-800/40 rounded-xl p-3 ml-4">
                  <div className="flex items-center justify-between text-[11px] text-sky-300 font-medium mb-1">
                    <span>You (Candidate)</span>
                    <span>10:14:08 AM</span>
                  </div>
                  <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                    "Sure! This maps directly to a sliding window problem using a hash map to track frequency of at most 2 keys..."
                  </p>
                </div>
              </>
            )}

            {activeTab === 'system' && (
              <>
                <div className="bg-purple-950/40 border border-purple-800/40 rounded-xl p-3">
                  <div className="flex items-center justify-between text-[11px] text-purple-300 font-medium mb-1">
                    <span>Interviewer</span>
                    <span>10:22:15 AM</span>
                  </div>
                  <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                    "How would you design a distributed URL shortening service like Bitly handling 100M daily writes with sub-50ms read latency?"
                  </p>
                </div>
              </>
            )}

            {activeTab === 'behavioral' && (
              <>
                <div className="bg-purple-950/40 border border-purple-800/40 rounded-xl p-3">
                  <div className="flex items-center justify-between text-[11px] text-purple-300 font-medium mb-1">
                    <span>Interviewer</span>
                    <span>10:45:30 AM</span>
                  </div>
                  <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                    "Tell me about a time when a critical microservice outage occurred in production under your watch. How did you handle it?"
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Screen capture trigger bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Scan className="w-4 h-4 text-sky-400" />
              <span>Screen OCR Active</span>
            </div>
            <div className="font-mono text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">
              Ctrl + Shift + A
            </div>
          </div>
        </div>

        {/* Right Side (7 Cols): AI Guidance & Code Stream */}
        <div className="lg:col-span-7 p-4 sm:p-6 bg-slate-900/60 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold text-brand-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
              AI Answer Stream (Groq ~0.2s)
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition text-xs font-medium"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Solution</span>
                </>
              )}
            </button>
          </div>

          {/* AI Content depending on Tab */}
          {activeTab === 'dsa' && (
            <div className="space-y-3">
              <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-xs leading-relaxed overflow-x-auto text-emerald-300">
                <div className="text-slate-500 mb-1"># Optimal Sliding Window (Two Pointers + Hash Map)</div>
                <div className="text-slate-500 mb-2"># Time: O(N) | Space: O(1) [Max 2 keys in map]</div>
                <pre>{`def totalFruit(fruits: list[int]) -> int:
    count = {}
    left = max_len = 0
    
    for right, val in enumerate(fruits):
        count[val] = count.get(val, 0) + 1
        
        while len(count) > 2:
            count[fruits[left]] -= 1
            if count[fruits[left]] == 0:
                del count[fruits[left]]
            left += 1
            
        max_len = max(max_len, right - left + 1)
        
    return max_len`}</pre>
              </div>

              {/* Hints and Edge Cases */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
                  <span className="font-semibold text-purple-300 block mb-1">⚡ Key Talking Points:</span>
                  <p className="text-slate-300 text-[11px] leading-normal">
                    Mention window validity invariant: hash map size never exceeds 2 before updating max_len.
                  </p>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
                  <span className="font-semibold text-sky-300 block mb-1">🛡️ Edge Cases:</span>
                  <p className="text-slate-300 text-[11px] leading-normal">
                    Single-fruit arrays, all identical numbers, alternating pattern [1, 2, 1, 2, 1].
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-3 text-xs leading-relaxed text-slate-200">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-brand-purple-400" />
                  1. Scale & Capacity Math
                </div>
                <p className="text-slate-300 text-xs">
                  Write QPS: ~1,200 QPS (Peak 2.4k). Read QPS: 12,000 QPS (10:1 ratio).
                  Storage: 100M URLs/day × 500 bytes = 50 GB/day (91 TB over 5 years).
                </p>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="font-bold text-emerald-300">
                  2. Architectural Components
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-300 text-xs">
                  <li><strong className="text-white">Hashing:</strong> Base62 encoding on 64-bit auto-incrementing Snowflake ID.</li>
                  <li><strong className="text-white">Database:</strong> Distributed DynamoDB / Cassandra for linear key-value lookups.</li>
                  <li><strong className="text-white">Cache Layer:</strong> Redis Cluster caching top 20% hot URLs with LRU eviction.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'behavioral' && (
            <div className="space-y-3 text-xs leading-relaxed text-slate-200">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <span className="text-[11px] font-bold text-brand-purple-400 uppercase tracking-wider">Situation & Task</span>
                <p className="text-slate-300 text-xs">
                  "During a high-traffic release, our payment webhook service breached its connection pool limit, causing 5% of checkout webhooks to fail."
                </p>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">Action Taken</span>
                <p className="text-slate-300 text-xs">
                  "I immediately enabled connection pooling with PgBouncer, implemented an asynchronous dead-letter queue with exponential backoff, and added a health circuit breaker."
                </p>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Quantifiable Result</span>
                <p className="text-slate-300 text-xs">
                  "Zero payment loss occurred, webhook retry latency dropped from 12s to 400ms, and we automated regression load tests to prevent recurrence."
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div className="bg-slate-950 px-4 sm:px-6 py-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span>Active Credits: <strong className="text-white font-mono">30</strong></span>
          <span className="text-slate-600">|</span>
          <span>Deduction: <strong className="text-emerald-400 font-mono">1 credit / answer</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Encrypted Gateway Active</span>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, CheckCircle, Network, ArrowRight } from 'lucide-react';
import { OnboardingPayload } from '../types';

interface GeneratingStepProps {
  payload: OnboardingPayload;
  onComplete: (payload: OnboardingPayload) => void;
}

interface NodePoint {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  category: string;
}

export const GeneratingStep: React.FC<GeneratingStepProps> = ({ payload, onComplete }) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [progress, setProgress] = useState(12);
  const [isDone, setIsDone] = useState(false);

  const company = payload.goals.dreamCompany || 'Target Company';

  const statusMessages = [
    { title: 'Reading platform history…', detail: 'Parsing solve distribution, difficulty tags, and speed patterns' },
    { title: 'Calibrating topic confidence…', detail: 'Weighting DSA modules, SQL fundamentals, and system subjects' },
    { title: `Cross-referencing ${company} patterns…`, detail: 'Filtering high-frequency questions and OA recurrence clusters' },
    { title: 'Building your Knowledge Graph…', detail: 'Synthesizing adaptive mastery nodes and personalized revision pathways' },
  ];

  /*
   * ===================================================================================
   * HOOK POINT: Actual Knowledge Graph API Integration Point
   * ===================================================================================
   * When integrating the real Clarity backend agent or LLM graph synthesizer,
   * replace the `useEffect` simulation below with an actual async POST request:
   *
   * async function synthesizeGraph(payload: OnboardingPayload) {
   *   const res = await fetch('/api/knowledge-graph/synthesize', {
   *     method: 'POST',
   *     headers: { 'Content-Type': 'application/json' },
   *     body: JSON.stringify(payload),
   *   });
   *   const data = await res.json();
   *   return data;
   * }
   * ===================================================================================
   */

  useEffect(() => {
    // Stage 1
    const t1 = setTimeout(() => {
      setCurrentStepIdx(1);
      setProgress(38);
    }, 1100);

    // Stage 2
    const t2 = setTimeout(() => {
      setCurrentStepIdx(2);
      setProgress(67);
    }, 2300);

    // Stage 3
    const t3 = setTimeout(() => {
      setCurrentStepIdx(3);
      setProgress(92);
    }, 3500);

    // Final completion stage
    const t4 = setTimeout(() => {
      setProgress(100);
      setIsDone(true);
    }, 4600);

    // Automatic transition callback after graph is synthesized
    const t5 = setTimeout(() => {
      onComplete(payload);
    }, 5400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [payload, onComplete]);

  // Nodes for the animated knowledge graph visualization
  const graphNodes: NodePoint[] = [
    { id: 'center', label: company, x: 200, y: 150, size: 28, color: '#C1592B', category: 'Goal' },
    { id: 'dp', label: 'Dynamic Prog.', x: 80, y: 70, size: 18, color: '#5B6B4D', category: 'DSA' },
    { id: 'trees', label: 'Trees & BST', x: 310, y: 80, size: 20, color: '#C1592B', category: 'DSA' },
    { id: 'graphs', label: 'Shortest Path', x: 320, y: 220, size: 19, color: '#1F2420', category: 'Algorithms' },
    { id: 'sql', label: 'SQL & DBMS', x: 80, y: 230, size: 17, color: '#5B6B4D', category: 'Systems' },
    { id: 'os', label: 'Operating Sys.', x: 195, y: 270, size: 16, color: '#1F2420', category: 'Core' },
    { id: 'heap', label: 'Heaps / Priority', x: 195, y: 35, size: 16, color: '#C1592B', category: 'DSA' },
  ];

  const graphEdges = [
    { from: 'center', to: 'dp' },
    { from: 'center', to: 'trees' },
    { from: 'center', to: 'graphs' },
    { from: 'center', to: 'sql' },
    { from: 'center', to: 'os' },
    { from: 'center', to: 'heap' },
    { from: 'dp', to: 'heap' },
    { from: 'trees', to: 'graphs' },
    { from: 'sql', to: 'os' },
  ];

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center text-center py-6 px-4">
      {/* Visual Canvas: Knowledge Graph Drawing Simulation */}
      <div className="relative w-[340px] sm:w-[400px] h-[300px] mb-8 select-none flex items-center justify-center">
        {/* Soft atmospheric ambient glow behind nodes */}
        <div
          className="absolute inset-0 rounded-full blur-[70px] opacity-25 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #C1592B 0%, #5B6B4D 50%, transparent 80%)' }}
        />

        <svg className="w-full h-full overflow-visible" viewBox="0 0 400 300">
          {/* Animated Connecting Edges */}
          {graphEdges.map((edge, i) => {
            const startNode = graphNodes.find((n) => n.id === edge.from)!;
            const endNode = graphNodes.find((n) => n.id === edge.to)!;
            return (
              <motion.line
                key={`edge-${edge.from}-${edge.to}`}
                x1={startNode.x}
                y1={startNode.y}
                x2={endNode.x}
                y2={endNode.y}
                stroke="#1F2420"
                strokeOpacity="0.2"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                transition={{ duration: 1.2, delay: i * 0.1, ease: 'easeInOut' }}
              />
            );
          })}

          {/* Connecting Pulse Particles */}
          {graphNodes.slice(1).map((node, i) => (
            <motion.circle
              key={`pulse-${node.id}`}
              cx={node.x}
              cy={node.y}
              r={node.size + 4}
              fill="none"
              stroke={node.color}
              strokeWidth="1.5"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: i * 0.3,
                ease: 'easeInOut',
              }}
            />
          ))}

          {/* Graph Nodes */}
          {graphNodes.map((node, i) => {
            const isCenter = node.id === 'center';
            return (
              <g key={node.id} className="cursor-default">
                {/* Node Circle */}
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size}
                  fill={node.color}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 260,
                    damping: 20,
                    delay: i * 0.12,
                  }}
                />

                {/* Node Text Label */}
                <motion.text
                  x={node.x}
                  y={node.y + node.size + 14}
                  textAnchor="middle"
                  fill="#1F2420"
                  fontSize={isCenter ? '13' : '11'}
                  fontWeight={isCenter ? '700' : '500'}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 0.85, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                >
                  {node.label}
                </motion.text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Progress Metric & Bar */}
      <div className="w-full max-w-md space-y-2 mb-6">
        <div className="flex justify-between items-baseline text-[12px] font-mono">
          <span className="text-[#1F2420]/60 uppercase tracking-wider">
            {isDone ? 'Graph Complete' : 'Synthesizing live model'}
          </span>
          <span className="font-bold text-[#C1592B]">{progress}%</span>
        </div>

        <div className="w-full h-1.5 rounded-full bg-[#1F2420]/10 overflow-hidden">
          <motion.div
            className="h-full bg-[#C1592B] rounded-full"
            initial={{ width: '10%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Dynamic Status Copy */}
      <div className="min-h-[70px] space-y-1">
        <h3
          className="text-[20px] sm:text-[22px] font-normal tracking-[-0.015em] text-[#1F2420] transition-all"
          style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
        >
          {statusMessages[currentStepIdx]?.title}
        </h3>
        <p className="text-[13px] text-[#1F2420]/65 max-w-sm mx-auto leading-relaxed">
          {statusMessages[currentStepIdx]?.detail}
        </p>
      </div>

      {/* Manual fast-forward affordance if user is in a hurry or previewing */}
      {isDone && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <button
            type="button"
            onClick={() => onComplete(payload)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[4px] bg-[#1F2420] text-[#FAF6F0] text-[14px] font-medium hover:bg-[#2d352f] transition-all shadow-xs cursor-pointer"
          >
            <span>Enter Your Knowledge Graph</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
};

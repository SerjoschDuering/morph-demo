// Competitive Intelligence Demo — shared data module
// All 10 CI apps import from here. Single source of truth.

export interface Entity {
  id: string; name: string; category: 'ai-lab' | 'cloud' | 'chips' | 'mystery';
  color: string; marketCap: string; hq: string; headcount: string;
  gpuFleet: string; revenue: string; founded: string; description: string;
  products: { name: string; desc: string }[];
  leadership: { name: string; role: string; from?: string }[];
  financials: { metric: string; value: string }[];
}

export interface Person {
  id: string; name: string; role: string; entity: string;
}

export interface Relationship {
  source: string; target: string; type: 'invest' | 'supply' | 'compete' | 'acquire' | 'partner' | 'hire';
  strength: number; rumored?: boolean; label?: string;
}

export interface Signal {
  id: string; source: 'sec' | 'patent' | 'job' | 'news' | 'satellite' | 'insider';
  entity: string; date: string; title: string; excerpt: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface TimelineEvent {
  id: string; date: string; entity: string; title: string; desc: string;
  type: 'funding' | 'launch' | 'partnership' | 'regulatory' | 'acquisition' | 'talent' | 'hardware';
}

export interface Location {
  id: string; entity: string; name: string; type: 'hq' | 'datacenter' | 'fab' | 'lab';
  lat: number; lng: number; details: string;
}

export interface ThreatScore {
  entity: string; compute: number; talent: number; product: number;
  capital: number; ecosystem: number; regulatory: number;
  trends: { compute: 'up'|'down'|'flat'; talent: 'up'|'down'|'flat'; product: 'up'|'down'|'flat';
    capital: 'up'|'down'|'flat'; ecosystem: 'up'|'down'|'flat'; regulatory: 'up'|'down'|'flat' };
}

export interface Scenario {
  id: string; name: string; params: Record<string, number>;
  winners: string[]; losers: string[]; wildcards: string[];
}

export const CATEGORIES = {
  'ai-lab': { color: '#a78bfa', label: 'AI Lab' },
  cloud: { color: '#60a5fa', label: 'Cloud' },
  chips: { color: '#fbbf24', label: 'Chips' },
  mystery: { color: '#f59e0b', label: 'Mystery' },
} as const;

export const ENTITIES: Entity[] = [
  { id: 'nvidia', name: 'Nvidia', category: 'chips', color: '#76b900', marketCap: '$3.2T', hq: 'Santa Clara, CA', headcount: '29,600', gpuFleet: 'N/A (manufacturer)', revenue: '$130B (TTM)', founded: '1993', description: 'Dominant GPU manufacturer powering the AI revolution. Controls 80%+ of AI training compute market.', products: [{ name: 'H100/H200', desc: 'Data center AI GPUs' }, { name: 'Blackwell B200', desc: 'Next-gen AI accelerator' }, { name: 'CUDA', desc: 'GPU computing platform' }, { name: 'DGX Cloud', desc: 'AI supercomputing service' }], leadership: [{ name: 'Jensen Huang', role: 'CEO & Founder' }, { name: 'Colette Kress', role: 'CFO' }], financials: [{ metric: 'Revenue Growth', value: '+122% YoY' }, { metric: 'Data Center Rev', value: '$104B' }, { metric: 'Gross Margin', value: '73%' }] },
  { id: 'openai', name: 'OpenAI', category: 'ai-lab', color: '#10a37f', marketCap: '$300B (est.)', hq: 'San Francisco, CA', headcount: '3,500', gpuFleet: '~600K H100 equiv.', revenue: '$13B ARR', founded: '2015', description: 'Creator of GPT and ChatGPT. Pioneer of large language models and RLHF.', products: [{ name: 'GPT-5', desc: 'Frontier language model' }, { name: 'ChatGPT', desc: '300M+ weekly users' }, { name: 'DALL-E', desc: 'Image generation' }, { name: 'Codex', desc: 'Code generation' }], leadership: [{ name: 'Sam Altman', role: 'CEO' }, { name: 'Mira Murati', role: 'CTO' }], financials: [{ metric: 'ARR', value: '$13B' }, { metric: 'Last Raise', value: '$40B (2025)' }, { metric: 'Valuation', value: '$300B' }] },
  { id: 'anthropic', name: 'Anthropic', category: 'ai-lab', color: '#d4a574', marketCap: '$61.5B (est.)', hq: 'San Francisco, CA', headcount: '1,500', gpuFleet: '~200K H100 equiv.', revenue: '$4B ARR', founded: '2021', description: 'AI safety company building Claude. Founded by former OpenAI researchers.', products: [{ name: 'Claude 4', desc: 'Frontier AI assistant' }, { name: 'Claude Code', desc: 'Agentic coding tool' }, { name: 'Constitutional AI', desc: 'Safety methodology' }], leadership: [{ name: 'Dario Amodei', role: 'CEO' }, { name: 'Daniela Amodei', role: 'President' }], financials: [{ metric: 'ARR', value: '$4B' }, { metric: 'Last Raise', value: '$8B (2025)' }, { metric: 'Valuation', value: '$61.5B' }] },
  { id: 'google', name: 'Google DeepMind', category: 'ai-lab', color: '#4285f4', marketCap: '$2.2T (Alphabet)', hq: 'London / Mountain View', headcount: '4,000+', gpuFleet: '~1M TPUv5 equiv.', revenue: 'Internal', founded: '2010/2014', description: 'Alphabet\'s AI research arm. Created AlphaFold, Gemini, and custom TPU chips.', products: [{ name: 'Gemini 2.5', desc: 'Multimodal AI model' }, { name: 'TPU v6', desc: 'Custom AI accelerator' }, { name: 'AlphaFold 3', desc: 'Protein structure prediction' }], leadership: [{ name: 'Demis Hassabis', role: 'CEO' }, { name: 'Jeff Dean', role: 'Chief Scientist' }], financials: [{ metric: 'Cloud AI Rev', value: '$43B' }, { metric: 'R&D Spend', value: '$45B' }, { metric: 'Capex', value: '$75B (2026)' }] },
  { id: 'xai', name: 'xAI', category: 'ai-lab', color: '#1da1f2', marketCap: '$75B (est.)', hq: 'Austin, TX', headcount: '600', gpuFleet: '200K H100 (Colossus)', revenue: '$1B (est.)', founded: '2023', description: 'Elon Musk\'s AI company. Built the Colossus supercluster. Making Grok.', products: [{ name: 'Grok-3', desc: 'Large language model' }, { name: 'Colossus', desc: '200K GPU supercluster' }], leadership: [{ name: 'Elon Musk', role: 'CEO' }, { name: 'Igor Babuschkin', role: 'VP Engineering' }], financials: [{ metric: 'Last Raise', value: '$12B (2025)' }, { metric: 'Valuation', value: '$75B' }] },
  { id: 'meta', name: 'Meta AI', category: 'ai-lab', color: '#0668e1', marketCap: '$1.6T (Meta)', hq: 'Menlo Park, CA', headcount: '2,000+', gpuFleet: '600K+ H100', revenue: 'Internal', founded: '2013', description: 'Open-source AI powerhouse. Llama models used globally. Massive GPU fleet.', products: [{ name: 'Llama 4', desc: 'Open-weight LLM' }, { name: 'Meta AI', desc: 'Assistant across apps' }], leadership: [{ name: 'Yann LeCun', role: 'Chief AI Scientist' }, { name: 'Chris Cox', role: 'CPO' }], financials: [{ metric: 'AI Capex', value: '$65B (2026)' }, { metric: 'Reality Labs Loss', value: '-$16B' }] },
  { id: 'microsoft', name: 'Microsoft', category: 'cloud', color: '#00a4ef', marketCap: '$3.3T', hq: 'Redmond, WA', headcount: '228,000', gpuFleet: '~500K H100 equiv.', revenue: '$254B', founded: '1975', description: 'OpenAI\'s biggest backer. Azure AI is the enterprise gateway to frontier models.', products: [{ name: 'Azure AI', desc: 'Cloud AI platform' }, { name: 'Copilot', desc: 'AI assistant ecosystem' }, { name: 'GitHub Copilot', desc: 'AI pair programmer' }], leadership: [{ name: 'Satya Nadella', role: 'CEO' }, { name: 'Kevin Scott', role: 'CTO' }], financials: [{ metric: 'Cloud Rev', value: '$105B' }, { metric: 'AI Capex', value: '$80B (2026)' }, { metric: 'OpenAI Invested', value: '$13B' }] },
  { id: 'tsmc', name: 'TSMC', category: 'chips', color: '#c4001a', marketCap: '$900B', hq: 'Hsinchu, Taiwan', headcount: '76,000', gpuFleet: 'N/A (manufacturer)', revenue: '$95B', founded: '1987', description: 'World\'s largest chip foundry. Fabricates 90%+ of advanced AI chips including Nvidia, AMD, Apple.', products: [{ name: 'N3E', desc: '3nm process node' }, { name: 'CoWoS', desc: 'Advanced packaging for AI' }, { name: 'N2', desc: 'Next-gen 2nm (2025)' }], leadership: [{ name: 'C.C. Wei', role: 'CEO' }, { name: 'Mark Liu', role: 'Chairman' }], financials: [{ metric: 'Revenue', value: '$95B' }, { metric: 'Capex', value: '$38B' }, { metric: 'Gross Margin', value: '57%' }] },
  { id: 'amd', name: 'AMD', category: 'chips', color: '#ed1c24', marketCap: '$200B', hq: 'Santa Clara, CA', headcount: '26,000', gpuFleet: 'N/A (manufacturer)', revenue: '$28B', founded: '1969', description: 'Nvidia\'s main GPU competitor. MI300X challenging H100 in inference workloads.', products: [{ name: 'MI300X', desc: 'AI accelerator' }, { name: 'EPYC', desc: 'Server CPUs' }, { name: 'ROCm', desc: 'GPU software stack' }], leadership: [{ name: 'Lisa Su', role: 'CEO' }, { name: 'Victor Peng', role: 'President' }], financials: [{ metric: 'Data Center Rev', value: '$12B' }, { metric: 'AI GPU Rev', value: '$5B' }, { metric: 'Growth', value: '+94% YoY' }] },
  { id: 'inference-systems', name: 'Inference Systems LLC', category: 'mystery', color: '#f59e0b', marketCap: '?', hq: 'Delaware (registered)', headcount: '~120 (est.)', gpuFleet: '? (rumored 50K H100)', revenue: '?', founded: '2024', description: 'Stealth entity. Delaware LLC with no public website. Patent filings suggest advanced MoE inference optimization. Multiple ex-DeepMind researchers.', products: [{ name: '???', desc: 'Unknown — 3 MoE inference patents filed' }], leadership: [{ name: '???', role: 'Unknown — linked to ex-DeepMind PhDs' }], financials: [{ metric: 'Funding', value: '? (rumored $500M)' }, { metric: 'Supermicro Order', value: '$180M (confirmed)' }] },
];

export const PEOPLE: Person[] = [
  { id: 'jensen', name: 'Jensen Huang', role: 'CEO', entity: 'nvidia' },
  { id: 'altman', name: 'Sam Altman', role: 'CEO', entity: 'openai' },
  { id: 'dario', name: 'Dario Amodei', role: 'CEO', entity: 'anthropic' },
  { id: 'demis', name: 'Demis Hassabis', role: 'CEO', entity: 'google' },
  { id: 'musk', name: 'Elon Musk', role: 'CEO', entity: 'xai' },
  { id: 'lecun', name: 'Yann LeCun', role: 'Chief AI Scientist', entity: 'meta' },
  { id: 'nadella', name: 'Satya Nadella', role: 'CEO', entity: 'microsoft' },
  { id: 'lisa', name: 'Lisa Su', role: 'CEO', entity: 'amd' },
  { id: 'brockman', name: 'Greg Brockman', role: 'President', entity: 'openai' },
  { id: 'murati', name: 'Mira Murati', role: 'CTO', entity: 'openai' },
  { id: 'daniela', name: 'Daniela Amodei', role: 'President', entity: 'anthropic' },
  { id: 'jeff-dean', name: 'Jeff Dean', role: 'Chief Scientist', entity: 'google' },
  { id: 'kress', name: 'Colette Kress', role: 'CFO', entity: 'nvidia' },
  { id: 'zuck', name: 'Mark Zuckerberg', role: 'CEO', entity: 'meta' },
  { id: 'kevin-scott', name: 'Kevin Scott', role: 'CTO', entity: 'microsoft' },
  { id: 'cc-wei', name: 'C.C. Wei', role: 'CEO', entity: 'tsmc' },
  { id: 'peng', name: 'Victor Peng', role: 'President', entity: 'amd' },
  { id: 'babuschkin', name: 'Igor Babuschkin', role: 'VP Engineering', entity: 'xai' },
  { id: 'ghost-cto', name: '??? (Unknown CTO)', role: 'Technical Lead', entity: 'inference-systems' },
  { id: 'ghost-researcher', name: '??? (Ex-DeepMind)', role: 'Chief Scientist', entity: 'inference-systems' },
];

export const RELATIONSHIPS: Relationship[] = [
  // Major investment flows
  { source: 'microsoft', target: 'openai', type: 'invest', strength: 10, label: '$13B invested' },
  { source: 'google', target: 'anthropic', type: 'invest', strength: 7, label: '$2B invested' },
  { source: 'microsoft', target: 'anthropic', type: 'invest', strength: 4, label: 'Minor stake' },
  // Supply chain — chip fabrication
  { source: 'nvidia', target: 'tsmc', type: 'supply', strength: 10, label: 'Primary fab partner' },
  { source: 'amd', target: 'tsmc', type: 'supply', strength: 9, label: 'Fab partner' },
  { source: 'google', target: 'tsmc', type: 'supply', strength: 6, label: 'TPU fabrication' },
  // Supply chain — GPU customers
  { source: 'meta', target: 'nvidia', type: 'supply', strength: 9, label: '600K H100 order' },
  { source: 'xai', target: 'nvidia', type: 'supply', strength: 8, label: '200K H100 Colossus' },
  { source: 'microsoft', target: 'nvidia', type: 'supply', strength: 8, label: 'Azure GPU fleet' },
  { source: 'nvidia', target: 'openai', type: 'supply', strength: 7, label: 'GPU allocation' },
  { source: 'anthropic', target: 'nvidia', type: 'supply', strength: 6, label: 'GPU customer' },
  { source: 'google', target: 'nvidia', type: 'supply', strength: 5, label: 'Supplemental to TPU' },
  // Competition — AI labs head-to-head
  { source: 'openai', target: 'anthropic', type: 'compete', strength: 9, label: 'Direct model rivals' },
  { source: 'openai', target: 'google', type: 'compete', strength: 9, label: 'Frontier model race' },
  { source: 'anthropic', target: 'google', type: 'compete', strength: 7, label: 'Enterprise AI' },
  { source: 'xai', target: 'openai', type: 'compete', strength: 7, label: 'Grok vs GPT' },
  { source: 'openai', target: 'meta', type: 'compete', strength: 6, label: 'Closed vs open-weight' },
  { source: 'meta', target: 'anthropic', type: 'compete', strength: 5, label: 'Open vs safety-first' },
  { source: 'xai', target: 'google', type: 'compete', strength: 5 },
  { source: 'xai', target: 'anthropic', type: 'compete', strength: 4 },
  // Competition — chips & cloud
  { source: 'nvidia', target: 'amd', type: 'compete', strength: 8, label: 'GPU duopoly' },
  { source: 'microsoft', target: 'google', type: 'compete', strength: 7, label: 'Cloud AI platforms' },
  { source: 'microsoft', target: 'meta', type: 'compete', strength: 5, label: 'Enterprise vs consumer' },
  { source: 'nvidia', target: 'google', type: 'compete', strength: 4, label: 'GPU vs TPU' },
  // Partnerships
  { source: 'anthropic', target: 'google', type: 'partner', strength: 6, label: 'Cloud partnership' },
  { source: 'openai', target: 'microsoft', type: 'partner', strength: 9, label: 'Azure exclusive' },
  { source: 'amd', target: 'meta', type: 'partner', strength: 5, label: 'MI300X deployment' },
  { source: 'amd', target: 'microsoft', type: 'partner', strength: 4, label: 'Azure MI300X option' },
  // Talent flows
  { source: 'openai', target: 'anthropic', type: 'hire', strength: 6, label: 'Amodei exodus (2021)' },
  { source: 'google', target: 'openai', type: 'hire', strength: 5, label: 'Sutskever, others' },
  { source: 'google', target: 'xai', type: 'hire', strength: 4, label: 'Babuschkin & team' },
  { source: 'meta', target: 'google', type: 'hire', strength: 3, label: 'Researcher poaching' },
  // Mystery entity — rumored connections
  { source: 'inference-systems', target: 'nvidia', type: 'supply', strength: 4, rumored: true, label: 'Rumored 50K H100 order' },
  { source: 'inference-systems', target: 'google', type: 'hire', strength: 6, rumored: true, label: '12 ex-DeepMind PhDs' },
  { source: 'inference-systems', target: 'anthropic', type: 'compete', strength: 3, rumored: true, label: 'Inference optimization' },
  { source: 'inference-systems', target: 'openai', type: 'compete', strength: 3, rumored: true, label: 'Stealth competitor' },
  { source: 'inference-systems', target: 'tsmc', type: 'supply', strength: 2, rumored: true, label: 'Custom ASIC rumor' },
  { source: 'inference-systems', target: 'meta', type: 'hire', strength: 3, rumored: true, label: '3 FAIR researchers joined' },
];

export const SIGNALS: Signal[] = [
  { id: 's1', source: 'sec', entity: 'nvidia', date: '2026-03-15', title: 'Nvidia Q4 earnings beat estimates', excerpt: 'Data center revenue up 122% YoY. Blackwell demand exceeds supply through 2027.', confidence: 'high' },
  { id: 's2', source: 'patent', entity: 'inference-systems', date: '2026-03-10', title: '3 MoE inference patents filed', excerpt: 'US Patent Office filings for novel mixture-of-experts routing at inference time.', confidence: 'high' },
  { id: 's3', source: 'job', entity: 'inference-systems', date: '2026-02-28', title: '12 PhD hires from DeepMind', excerpt: 'LinkedIn analysis shows cluster of ex-DeepMind researchers joining undisclosed entity.', confidence: 'medium' },
  { id: 's4', source: 'satellite', entity: 'inference-systems', date: '2026-03-20', title: 'Supermicro rack delivery to unmarked facility', excerpt: 'Satellite imagery of Nevada data center shows $180M Supermicro server delivery.', confidence: 'medium' },
  { id: 's5', source: 'news', entity: 'openai', date: '2026-04-01', title: 'OpenAI closes $40B round at $300B', excerpt: 'Largest private funding round in history. SoftBank leads.', confidence: 'high' },
  { id: 's6', source: 'insider', entity: 'anthropic', date: '2026-03-25', title: 'Claude 4.5 internal benchmarks leaked', excerpt: 'Anonymous source claims Claude 4.5 surpasses GPT-5 on coding and math.', confidence: 'low' },
  { id: 's7', source: 'sec', entity: 'tsmc', date: '2026-04-05', title: 'TSMC Arizona fab Phase 2 approved', excerpt: '$40B expansion for 2nm process. US CHIPS Act subsidies secured.', confidence: 'high' },
  { id: 's8', source: 'news', entity: 'xai', date: '2026-03-18', title: 'xAI Colossus doubles to 200K GPUs', excerpt: 'Memphis supercluster expansion complete. Largest single training cluster.', confidence: 'high' },
  { id: 's9', source: 'patent', entity: 'google', date: '2026-02-15', title: 'TPU v6 architecture patent', excerpt: 'Novel chip-to-chip interconnect for 100K+ TPU pods.', confidence: 'high' },
  { id: 's10', source: 'job', entity: 'meta', date: '2026-03-05', title: 'Meta hiring 500+ AI researchers', excerpt: 'Aggressive hiring push for Llama 5 development. Targeting academic researchers.', confidence: 'medium' },
  { id: 's11', source: 'news', entity: 'microsoft', date: '2026-04-08', title: 'Azure AI revenue surpasses $100B run rate', excerpt: 'Enterprise AI adoption driving record cloud growth.', confidence: 'high' },
  { id: 's12', source: 'insider', entity: 'inference-systems', date: '2026-04-10', title: 'Inference Systems linked to sovereign fund', excerpt: 'Unverified: Middle Eastern sovereign wealth fund backing. $500M seed.', confidence: 'low' },
  { id: 's13', source: 'sec', entity: 'amd', date: '2026-03-28', title: 'AMD MI400 announcement', excerpt: 'Next-gen AI accelerator targeting 2x inference throughput vs H200.', confidence: 'high' },
  { id: 's14', source: 'news', entity: 'nvidia', date: '2026-04-02', title: 'Nvidia announces Rubin GPU architecture', excerpt: 'Next-gen platform succeeding Blackwell. Expected 2027.', confidence: 'high' },
  { id: 's15', source: 'satellite', entity: 'google', date: '2026-03-12', title: 'New Google data center construction in Finland', excerpt: 'Satellite imagery confirms 500MW facility under construction.', confidence: 'medium' },
  { id: 's16', source: 'news', entity: 'anthropic', date: '2026-04-06', title: 'Anthropic launches Claude Code agent', excerpt: 'Agentic coding tool achieves 72% on SWE-bench Verified.', confidence: 'high' },
  { id: 's17', source: 'patent', entity: 'openai', date: '2026-02-20', title: 'World model training patent', excerpt: 'Patent for training world models from video prediction data.', confidence: 'medium' },
  { id: 's18', source: 'news', entity: 'meta', date: '2026-03-30', title: 'Llama 4 Scout and Maverick released', excerpt: 'Open-weight MoE models with 10M token context window.', confidence: 'high' },
];

export const EVENTS: TimelineEvent[] = [
  { id: 'e1', date: '2023-03-14', entity: 'openai', title: 'GPT-4 Launch', desc: 'Multimodal LLM sets new benchmarks', type: 'launch' },
  { id: 'e2', date: '2023-07-11', entity: 'anthropic', title: 'Claude 2 Released', desc: 'Constitutional AI approach gains traction', type: 'launch' },
  { id: 'e3', date: '2023-07-18', entity: 'meta', title: 'Llama 2 Open Release', desc: 'Open-weight LLM disrupts market', type: 'launch' },
  { id: 'e4', date: '2023-11-06', entity: 'openai', title: 'GPT-4 Turbo + GPTs', desc: 'Custom GPTs and 128K context', type: 'launch' },
  { id: 'e5', date: '2023-12-06', entity: 'google', title: 'Gemini Launch', desc: 'Multimodal AI model family', type: 'launch' },
  { id: 'e6', date: '2024-01-29', entity: 'microsoft', title: '$13B OpenAI Investment', desc: 'Largest AI investment in history', type: 'funding' },
  { id: 'e7', date: '2024-03-04', entity: 'anthropic', title: 'Claude 3 Opus', desc: 'Best-in-class reasoning model', type: 'launch' },
  { id: 'e8', date: '2024-03-18', entity: 'nvidia', title: 'Blackwell B200 Announced', desc: '20 petaflops AI chip', type: 'hardware' },
  { id: 'e9', date: '2024-04-18', entity: 'meta', title: 'Llama 3 Released', desc: '70B open-weight with 15T tokens', type: 'launch' },
  { id: 'e10', date: '2024-05-13', entity: 'openai', title: 'GPT-4o Launch', desc: 'Omni model with native audio', type: 'launch' },
  { id: 'e11', date: '2024-07-23', entity: 'xai', title: 'xAI Founded', desc: 'Elon Musk launches AI company', type: 'funding' },
  { id: 'e12', date: '2024-09-12', entity: 'openai', title: 'o1 Reasoning Model', desc: 'Chain-of-thought at inference time', type: 'launch' },
  { id: 'e13', date: '2024-11-20', entity: 'nvidia', title: 'Nvidia hits $3T market cap', desc: 'Most valuable public company', type: 'funding' },
  { id: 'e14', date: '2024-12-09', entity: 'google', title: 'Gemini 2.0 Flash', desc: 'Multimodal with agentic capabilities', type: 'launch' },
  { id: 'e15', date: '2025-01-30', entity: 'google', title: 'DeepSeek R1 disruption', desc: 'Open model matches o1 at 3% cost', type: 'launch' },
  { id: 'e16', date: '2025-02-24', entity: 'anthropic', title: 'Claude 3.5 Sonnet Agentic', desc: 'Computer use and tool orchestration', type: 'launch' },
  { id: 'e17', date: '2025-03-15', entity: 'xai', title: 'Colossus 200K GPU Online', desc: 'World\'s largest AI supercluster', type: 'hardware' },
  { id: 'e18', date: '2025-04-01', entity: 'openai', title: '$40B Funding Round', desc: 'SoftBank leads at $300B valuation', type: 'funding' },
  { id: 'e19', date: '2025-05-20', entity: 'tsmc', title: 'N2 Mass Production', desc: '2nm process node begins production', type: 'hardware' },
  { id: 'e20', date: '2025-06-10', entity: 'anthropic', title: 'Claude 4 Opus', desc: 'Frontier reasoning + agency', type: 'launch' },
  { id: 'e21', date: '2025-07-15', entity: 'meta', title: 'Llama 4 Maverick', desc: 'Open-weight MoE with 10M context', type: 'launch' },
  { id: 'e22', date: '2025-08-01', entity: 'microsoft', title: 'Azure AI $100B run rate', desc: 'Enterprise AI adoption milestone', type: 'funding' },
  { id: 'e23', date: '2025-09-01', entity: 'inference-systems', title: 'LLC Registered in Delaware', desc: 'Mystery entity appears in state records', type: 'funding' },
  { id: 'e24', date: '2025-10-15', entity: 'google', title: 'TPU v6 Deployment', desc: '100K pod for Gemini training', type: 'hardware' },
  { id: 'e25', date: '2025-11-20', entity: 'amd', title: 'MI400 Announcement', desc: '2x inference throughput vs H200', type: 'hardware' },
  { id: 'e26', date: '2025-12-01', entity: 'nvidia', title: 'Rubin Architecture Revealed', desc: 'Post-Blackwell GPU roadmap', type: 'hardware' },
  { id: 'e27', date: '2026-01-15', entity: 'inference-systems', title: 'First Patent Filings', desc: '3 MoE inference optimization patents', type: 'launch' },
  { id: 'e28', date: '2026-02-01', entity: 'openai', title: 'GPT-5 Internal Testing', desc: 'Rumored next-gen model in testing', type: 'launch' },
  { id: 'e29', date: '2026-03-01', entity: 'inference-systems', title: '$180M Supermicro Order', desc: 'Hardware delivery to Nevada facility', type: 'hardware' },
  { id: 'e30', date: '2026-03-15', entity: 'tsmc', title: 'Arizona Fab Phase 2', desc: '$40B expansion approved', type: 'hardware' },
  { id: 'e31', date: '2026-04-06', entity: 'anthropic', title: 'Claude Code Launch', desc: 'Agentic coding tool released', type: 'launch' },
  { id: 'e32', date: '2026-04-10', entity: 'xai', title: 'Grok-3 Release', desc: 'Competitive with Claude and GPT-5', type: 'launch' },
];

export const LOCATIONS: Location[] = [
  { id: 'l1', entity: 'nvidia', name: 'Nvidia HQ', type: 'hq', lat: 37.37, lng: -121.96, details: 'Santa Clara headquarters' },
  { id: 'l2', entity: 'openai', name: 'OpenAI HQ', type: 'hq', lat: 37.79, lng: -122.39, details: 'Mission District, San Francisco' },
  { id: 'l3', entity: 'anthropic', name: 'Anthropic HQ', type: 'hq', lat: 37.78, lng: -122.40, details: 'San Francisco' },
  { id: 'l4', entity: 'google', name: 'DeepMind London', type: 'hq', lat: 51.53, lng: -0.13, details: 'Kings Cross, London' },
  { id: 'l5', entity: 'xai', name: 'xAI HQ', type: 'hq', lat: 30.27, lng: -97.74, details: 'Austin, Texas' },
  { id: 'l6', entity: 'meta', name: 'Meta AI HQ', type: 'hq', lat: 37.48, lng: -122.15, details: 'Menlo Park, California' },
  { id: 'l7', entity: 'microsoft', name: 'Microsoft HQ', type: 'hq', lat: 47.64, lng: -122.14, details: 'Redmond, Washington' },
  { id: 'l8', entity: 'tsmc', name: 'TSMC HQ', type: 'hq', lat: 24.77, lng: 120.99, details: 'Hsinchu Science Park, Taiwan' },
  { id: 'l9', entity: 'amd', name: 'AMD HQ', type: 'hq', lat: 37.38, lng: -121.97, details: 'Santa Clara, California' },
  { id: 'l10', entity: 'tsmc', name: 'TSMC Arizona Fab', type: 'fab', lat: 33.67, lng: -112.01, details: 'Phoenix, AZ — $40B facility' },
  { id: 'l11', entity: 'xai', name: 'Colossus Supercluster', type: 'datacenter', lat: 35.15, lng: -90.05, details: 'Memphis, TN — 200K H100 GPUs' },
  { id: 'l12', entity: 'microsoft', name: 'Azure East US', type: 'datacenter', lat: 39.01, lng: -77.47, details: 'Virginia data center complex' },
  { id: 'l13', entity: 'google', name: 'Google Finland DC', type: 'datacenter', lat: 60.87, lng: 26.95, details: 'Hamina — 500MW under construction' },
  { id: 'l14', entity: 'meta', name: 'Meta Prineville DC', type: 'datacenter', lat: 44.30, lng: -120.83, details: 'Oregon mega data center' },
  { id: 'l15', entity: 'nvidia', name: 'Nvidia Israel R&D', type: 'lab', lat: 32.07, lng: 34.77, details: 'Tel Aviv — Mellanox networking' },
  { id: 'l16', entity: 'inference-systems', name: 'Mystery Nevada Facility', type: 'datacenter', lat: 39.53, lng: -119.81, details: 'Reno, NV — satellite-confirmed' },
  { id: 'l17', entity: 'google', name: 'Google Zurich', type: 'lab', lat: 47.37, lng: 8.54, details: 'Zurich AI research lab' },
  { id: 'l18', entity: 'tsmc', name: 'TSMC Japan Fab', type: 'fab', lat: 32.80, lng: 130.74, details: 'Kumamoto — JASM joint venture' },
  { id: 'l19', entity: 'microsoft', name: 'Azure West Europe', type: 'datacenter', lat: 52.34, lng: 4.89, details: 'Netherlands data center' },
  { id: 'l20', entity: 'openai', name: 'OpenAI London', type: 'lab', lat: 51.51, lng: -0.12, details: 'London office — safety research' },
];

export const THREAT_SCORES: ThreatScore[] = [
  { entity: 'nvidia', compute: 10, talent: 9, product: 10, capital: 10, ecosystem: 10, regulatory: 6, trends: { compute: 'up', talent: 'up', product: 'up', capital: 'up', ecosystem: 'up', regulatory: 'down' } },
  { entity: 'openai', compute: 8, talent: 9, product: 9, capital: 9, ecosystem: 8, regulatory: 5, trends: { compute: 'up', talent: 'flat', product: 'up', capital: 'up', ecosystem: 'up', regulatory: 'down' } },
  { entity: 'anthropic', compute: 6, talent: 9, product: 8, capital: 7, ecosystem: 6, regulatory: 8, trends: { compute: 'up', talent: 'up', product: 'up', capital: 'up', ecosystem: 'up', regulatory: 'up' } },
  { entity: 'google', compute: 10, talent: 10, product: 8, capital: 10, ecosystem: 9, regulatory: 5, trends: { compute: 'up', talent: 'flat', product: 'up', capital: 'flat', ecosystem: 'flat', regulatory: 'down' } },
  { entity: 'xai', compute: 7, talent: 6, product: 6, capital: 8, ecosystem: 4, regulatory: 4, trends: { compute: 'up', talent: 'up', product: 'up', capital: 'up', ecosystem: 'up', regulatory: 'flat' } },
  { entity: 'meta', compute: 8, talent: 8, product: 7, capital: 9, ecosystem: 9, regulatory: 4, trends: { compute: 'up', talent: 'flat', product: 'up', capital: 'flat', ecosystem: 'up', regulatory: 'down' } },
  { entity: 'microsoft', compute: 8, talent: 7, product: 8, capital: 10, ecosystem: 9, regulatory: 6, trends: { compute: 'up', talent: 'flat', product: 'up', capital: 'up', ecosystem: 'up', regulatory: 'flat' } },
  { entity: 'tsmc', compute: 10, talent: 9, product: 10, capital: 8, ecosystem: 10, regulatory: 7, trends: { compute: 'up', talent: 'up', product: 'up', capital: 'up', ecosystem: 'flat', regulatory: 'up' } },
  { entity: 'amd', compute: 6, talent: 7, product: 7, capital: 6, ecosystem: 5, regulatory: 7, trends: { compute: 'up', talent: 'up', product: 'up', capital: 'flat', ecosystem: 'up', regulatory: 'flat' } },
  { entity: 'inference-systems', compute: 4, talent: 7, product: 3, capital: 5, ecosystem: 1, regulatory: 2, trends: { compute: 'up', talent: 'up', product: 'up', capital: 'up', ecosystem: 'up', regulatory: 'flat' } },
];

export const SCENARIOS: Scenario[] = [
  { id: 'status-quo', name: 'Status Quo', params: { gpuSupply: 50, regulatory: 30, talent: 50, capital: 60, openSource: 40 }, winners: ['nvidia', 'openai', 'microsoft'], losers: ['amd'], wildcards: ['inference-systems'] },
  { id: 'gpu-embargo', name: 'GPU Embargo', params: { gpuSupply: 10, regulatory: 80, talent: 40, capital: 40, openSource: 50 }, winners: ['tsmc', 'google', 'amd'], losers: ['nvidia', 'xai', 'meta'], wildcards: ['inference-systems', 'anthropic'] },
  { id: 'open-source-wins', name: 'Open Source Wins', params: { gpuSupply: 60, regulatory: 20, talent: 60, capital: 50, openSource: 90 }, winners: ['meta', 'amd', 'nvidia'], losers: ['openai', 'anthropic'], wildcards: ['inference-systems'] },
  { id: 'regulatory-crackdown', name: 'Regulatory Crackdown', params: { gpuSupply: 40, regulatory: 90, talent: 30, capital: 30, openSource: 30 }, winners: ['anthropic', 'google', 'microsoft'], losers: ['xai', 'meta', 'inference-systems'], wildcards: ['openai'] },
];

// Entity name registry for entity pill detection in chat
export const ENTITY_NAMES = ENTITIES.map(e => e.name);

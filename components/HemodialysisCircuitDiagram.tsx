import React, { useState, useRef, useEffect } from 'react';
import { Settings2, Activity, Syringe, Sliders, AlertTriangle, Droplets, Gauge, FlaskConical, FileText, ZoomIn, ZoomOut, RotateCcw, CheckSquare, Square } from 'lucide-react';

interface DiagramPart {
  id: string;
  label: string;
  description: string;
  query: string;
  isRisk?: boolean;
  riskLevel?: 'warning' | 'high';
}

interface HemodialysisCircuitDiagramProps {
  onPartClick: (query: string) => void;
}

type Mode = 'CVVH' | 'CVVHDF';
type Dilution = 'Pre' | 'Post';
type Anticoagulation = 'Heparin' | 'CitrateCa' | 'Nafamostat' | 'None';

export const HemodialysisCircuitDiagram: React.FC<HemodialysisCircuitDiagramProps> = ({ onPartClick }) => {
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);
  
  // Basic Settings
  const [mode, setMode] = useState<Mode>('CVVH');
  const [dilution, setDilution] = useState<Dilution>('Pre');
  const [anticoagulation, setAnticoagulation] = useState<Anticoagulation>('Heparin');

  // Advanced Flow Parameters
  const [qb, setQb] = useState(200);      // ml/min
  const [qRep, setQRep] = useState(1500); // ml/h
  const [qD, setQD] = useState(1000);     // ml/h (only for CVVHDF)
  const [netUf, setNetUf] = useState(100);// ml/h

  // Pressure Parameters (mmHg)
  const [pArterial, setPArterial] = useState(-80);
  const [pVenous, setPVenous] = useState(80);
  const [pPreFilter, setPPreFilter] = useState(140);
  const [tmp, setTmp] = useState(30);

  // Anticoagulation Parameters & Lab Results
  // Heparin
  const [heparinRateAbs, setHeparinRateAbs] = useState(500); // units/h
  const [aptt, setAptt] = useState(45); // seconds

  // RCA (Citrate-Calcium)
  // 4% Sodium Citrate ~ 136 mmol/L
  const [citrateFlow, setCitrateFlow] = useState(140); // ml/h
  const [calciumFlow, setCalciumFlow] = useState(40);  // ml/h (10% CaCl or gluconate)
  const [postFilterCa, setPostFilterCa] = useState(0.35); // mmol/L (Ionized)
  const [peripheralCa, setPeripheralCa] = useState(1.10); // mmol/L (Ionized)
  
  // New Metabolic Lab Results
  const [ph, setPh] = useState(7.35);     
  const [pO2, setPO2] = useState(90);     // mmHg
  const [pCO2, setPCO2] = useState(40);   // mmHg
  const [be, setBe] = useState(0);        // mmol/L
  const [hco3, setHco3] = useState(24.0); // mmol/L
  const [lac, setLac] = useState(1.2);    // mmol/L
  
  // Total Calcium handling (Optional)
  const [hasTCa, setHasTCa] = useState(true);
  const [tCa, setTCa] = useState(2.25);   // mmol/L (Total Calcium)

  // Nafamostat
  const [nafamostatDose, setNafamostatDose] = useState(20); // mg/h
  const [act, setAct] = useState(150); // seconds

  // Zoom & Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // ---- Logic & Calculations ----
  const HCT = 0.30;
  
  // 1. Calculate Plasma Flow (Qp) in ml/h
  const qPlasma = qb * (1 - HCT) * 60;

  // 2. Calculate Filtration Fraction (FF)
  const totalConvective = qRep + netUf;
  let ff = 0;
  
  if (dilution === 'Post') {
     ff = totalConvective / qPlasma;
  } else {
     ff = totalConvective / (qPlasma + qRep);
  }

  const ffPercent = (ff * 100).toFixed(1);
  const ffValue = parseFloat(ffPercent);

  // Risk Thresholds (Flow)
  const isRiskHighFF = dilution === 'Post' && ffValue > 25; 
  const isRiskMedFF = dilution === 'Post' && ffValue > 20 && ffValue <= 25; 
  const isEfficiencyReduced = dilution === 'Pre' && ffValue > 20; 
  const isRiskLowQb = qb < 150; 

  // Calculate Total Effluent
  const totalEffluent = qRep + netUf + (mode === 'CVVHDF' ? qD : 0);

  // ---- Dose Calculations (mmol/L) ----
  const bloodFlowLph = (qb * 60) / 1000; 
  const citrateConc = 136; // mmol/L for 4% solution
  const citrateDose = (citrateFlow / 1000 * citrateConc) / bloodFlowLph;

  const effluentLph = totalEffluent / 1000;
  const calciumConc = 0.225; // mmol/ml
  const calciumDose = (calciumFlow * calciumConc) / (effluentLph || 1); // Avoid div by zero

  const caRatio = hasTCa ? (tCa / (peripheralCa || 0.01)) : 0;
  const isCaRatioHigh = hasTCa && caRatio > 2.5;

  // Helper to set Citrate Flow by Target Dose
  const setCitrateByDose = (targetDose: number) => {
    // Flow = (Dose * Qb_Lph) / Conc * 1000
    // Flow = (Dose * (Qb*60/1000)) / 136 * 1000
    const reqFlow = (targetDose * bloodFlowLph * 1000) / citrateConc;
    setCitrateFlow(Math.round(reqFlow));
  };

  // ---- Pressure Analysis Logic ----
  const getPressureRecommendation = () => {
    let advice = [];
    if (pArterial < -150) advice.push("PA 动脉压过低 (<-150)。提示引血不畅。");
    if (pVenous > 150) advice.push("PV 静脉压过高 (>150)。提示回血受阻。");
    if (tmp > 200) advice.push("TMP 跨膜压过高 (>200)。提示滤器堵塞。");
    const pDrop = pPreFilter - pVenous;
    if (pDrop > 150) advice.push(`ΔP 滤器压降过大 (${pDrop} mmHg)。提示凝血。`);
    
    return advice.length > 0 ? advice.join('\n') : "压力指标正常。";
  };
  const pressureRecommendation = getPressureRecommendation();
  const isPressureWarning = pressureRecommendation.includes("提示");

  // ---- Clinical Analysis Logic ----
  const getAnalysisRecommendation = () => {
    let advice = [];
    const isRCA = anticoagulation === 'CitrateCa';

    if (anticoagulation === 'None') advice.push("警告：无肝素模式，高凝血风险！");
    if (anticoagulation === 'Heparin') {
      if (aptt < 60) advice.push("APTT < 60s。建议：追加肝素并上调流速。");
      else if (aptt > 100) advice.push("APTT > 100s。建议：暂停并下调肝素。");
    }
    if (isRCA) {
      if (citrateDose < 2.5) advice.push(`枸橼酸量偏低 (${citrateDose.toFixed(1)} < 2.5)。凝血风险。`);
      if (postFilterCa > 0.45) advice.push("滤器后Ca > 0.45。建议：上调枸橼酸流速。");
      if (peripheralCa < 0.90) advice.push("外周Ca < 0.90。建议：补钙。");
      if (isCaRatioHigh) advice.push(`【警告】T/i Ca比值 ${caRatio.toFixed(1)} (>2.5)。提示枸橼酸蓄积！`);
    }

    let acidBaseMsg = "";
    if (ph < 7.35) {
       acidBaseMsg = `【酸中毒】pH ${ph}。`;
       let types = [];
       if (pCO2 > 45) types.push(`呼吸性 (pCO2 ${pCO2})`);
       if (hco3 < 22 || be < -3) types.push(`代谢性 (HCO3 ${hco3})`);
       
       acidBaseMsg += types.join(' + ') + "。";

       if (types.includes(`代谢性 (HCO3 ${hco3})`)) {
           if (isRCA && (isCaRatioHigh || lac > 4)) acidBaseMsg += " 疑枸橼酸蓄积。建议：降枸橼酸，增透析液。";
           else acidBaseMsg += " 建议：补碱或调置换液。";
       }
       if (types.includes(`呼吸性 (pCO2 ${pCO2})`)) {
           acidBaseMsg += " 建议：检查呼吸机参数。";
       }
       advice.push(acidBaseMsg);
    } else if (ph > 7.45) {
       acidBaseMsg = `【碱中毒】pH ${ph}。`;
       let types = [];
       if (pCO2 < 35) types.push(`呼吸性 (pCO2 ${pCO2})`);
       if (hco3 > 26 || be > 3) types.push(`代谢性 (HCO3 ${hco3})`);

       acidBaseMsg += types.join(' + ') + "。";

       if (types.includes(`代谢性 (HCO3 ${hco3})`)) {
          if (isRCA) acidBaseMsg += " 疑枸橼酸负荷过大。建议：降枸橼酸或血流速。";
          else acidBaseMsg += " 建议：调置换液配方。";
       }
       advice.push(acidBaseMsg);
    }

    if (lac > 4) advice.push(`【高乳酸】Lac ${lac}。RCA慎用。`);

    return advice.length > 0 ? advice.join('\n') : "指标在目标范围内。";
  };

  const analysisRecommendation = getAnalysisRecommendation();
  const isAnalysisWarning = analysisRecommendation.includes("建议") || analysisRecommendation.includes("警告") || analysisRecommendation.includes("中毒") || analysisRecommendation.includes("偏低") || analysisRecommendation.includes("偏高");

  const parts: Record<string, DiagramPart> = {
    dialyzer: {
      id: 'dialyzer',
      label: '滤器',
      description: `TMP: ${tmp}`,
      query: tmp > 200 ? 'TMP过高意味着什么？' : (isRiskHighFF ? '高滤过分数如何导致凝血？' : '滤器中空纤维的凝血机制？'),
      isRisk: isRiskHighFF || tmp > 200,
      riskLevel: 'high'
    },
    pump: { id: 'pump', label: '血泵', description: `${qb} ml/min`, query: '血泵造成的溶血风险？' },
    chamber: { id: 'chamber', label: '静脉壶', description: `PV: ${pVenous}`, query: '静脉壶液面与凝血的关系？', isRisk: pVenous > 150, riskLevel: 'warning' },
    access: { id: 'access', label: '血管通路', description: `PA: ${pArterial}`, query: '动静脉压差对管路寿命的影响？', isRisk: pArterial < -150, riskLevel: 'warning' },
    replacement: { id: 'replacement', label: '置换液', description: `Qrep: ${qRep}`, query: '前稀释与后稀释对凝血的影响区别？' },
    waste: { id: 'waste', label: '废液', description: 'Out', query: '废液颜色异常说明什么？' },
    dialysateIn: { id: 'dialysateIn', label: '透析液', description: `Qd: ${qD}`, query: '透析液温度设置？' },
    anticoagulantPump: { id: 'anticoagulantPump', label: '抗凝泵', description: 'Infusion', query: '抗凝剂注入点的选择？' },
    calciumPump: { id: 'calciumPump', label: '钙泵', description: 'Ca++', query: '钙剂回输位置的重要性？' }
  };

  const handleInteraction = (partId: string) => {
    if (parts[partId]) onPartClick(parts[partId].query);
  };

  const getOpacity = (id: string) => hoveredPart && hoveredPart !== id ? 0.3 : 1;
  const getStrokeColor = (id: string, defaultColor: string) => {
    const part = parts[id];
    if (part?.isRisk) return part.riskLevel === 'high' ? '#ef4444' : '#f59e0b';
    return hoveredPart === id ? '#0ea5e9' : defaultColor;
  };

  // --- Pan/Zoom Handlers ---
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      const newScale = Math.min(Math.max(0.5, scale + delta), 3);
      setScale(newScale);
    }
  };
  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); };
  const handleMouseMove = (e: React.MouseEvent) => { if (isDragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="flex flex-col w-full h-full">
      {/* --- Top Section: Settings --- */}
      <div className="bg-gray-50 border-b border-gray-200 flex flex-col shrink-0 max-h-[60%] overflow-y-auto custom-scrollbar">
        
        {/* Mode Selection */}
        <div className="p-3 border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-500 w-12 shrink-0">治疗模式</span>
              <div className="flex gap-1 flex-1">
                {['CVVH', 'CVVHDF'].map(m => (
                  <button 
                    key={m} 
                    onClick={() => setMode(m as Mode)} 
                    className={`flex-1 px-3 py-1 text-xs rounded-md border transition-all ${
                      mode === m 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-semibold' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-500 w-12 shrink-0">稀释方式</span>
              <div className="flex gap-1 flex-1">
                {['Pre', 'Post'].map(d => (
                  <button 
                    key={d} 
                    onClick={() => setDilution(d as Dilution)} 
                    className={`flex-1 px-3 py-1 text-xs rounded-md border transition-all ${
                      dilution === d 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-semibold' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {d === 'Pre' ? '前稀释 (Pre)' : '后稀释 (Post)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-500 w-12 shrink-0">抗凝方案</span>
              <div className="flex gap-1 flex-1 overflow-x-auto no-scrollbar">
                {['Heparin', 'CitrateCa', 'Nafamostat', 'None'].map(ac => (
                  <button 
                    key={ac} 
                    onClick={() => setAnticoagulation(ac as Anticoagulation)} 
                    className={`px-3 py-1 text-xs rounded-md border whitespace-nowrap transition-all ${
                      anticoagulation === ac 
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm font-semibold' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {ac === 'Heparin' ? '肝素' : ac === 'CitrateCa' ? '枸橼酸-钙' : ac === 'Nafamostat' ? '奈莫司他' : '无抗凝'}
                  </button>
                ))}
              </div>
            </div>
        </div>

        {/* Parameters Grid */}
        <div className="p-3 bg-gray-50/50 space-y-3">
            <div className="space-y-2">
                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase"><Sliders size={10}/> 流速 & 压力</div>
                
                <div className="grid grid-cols-4 gap-2">
                    {/* Flows */}
                    <div className="col-span-1 space-y-0.5">
                        <label className="text-[9px] text-gray-500 block">血泵 Qb</label>
                        <input type="range" min="100" max="400" step="10" value={qb} onChange={e=>setQb(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded appearance-none accent-gray-600 block"/>
                        <div className="text-[9px] font-mono text-right">{qb}</div>
                    </div>
                    
                    <div className="col-span-1 space-y-0.5">
                        <label className="text-[9px] text-purple-600 block">置换液 Qrep</label>
                        <input type="range" min="0" max="4000" step="100" value={qRep} onChange={e=>setQRep(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded appearance-none accent-purple-600 block"/>
                        <div className="text-[9px] font-mono text-right">{qRep}</div>
                    </div>
                    
                    <div className="col-span-1 space-y-0.5">
                        <label className={`text-[9px] block ${mode === 'CVVH' ? 'text-gray-300' : 'text-green-600'}`}>透析液 Qd</label>
                        <input 
                           type="range" min="0" max="4000" step="100" 
                           value={qD} onChange={e=>setQD(Number(e.target.value))} 
                           disabled={mode === 'CVVH'}
                           className={`w-full h-1 rounded appearance-none block ${mode === 'CVVH' ? 'bg-gray-100 accent-gray-300' : 'bg-gray-200 accent-green-600'}`}
                        />
                        <div className={`text-[9px] font-mono text-right ${mode === 'CVVH' ? 'text-gray-300' : ''}`}>{qD}</div>
                    </div>
                    
                    <div className="col-span-1 space-y-0.5">
                        <label className="text-[9px] text-amber-600 block truncate" title="脱水 (NetUF)">废液 Total</label>
                        <input type="range" min="0" max="500" step="10" value={netUf} onChange={e=>setNetUf(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded appearance-none accent-amber-600 block"/>
                        <div className="text-[9px] font-mono text-right flex justify-between">
                            <span className="text-gray-400" title="NetUF">{netUf}</span>
                            <span className="font-bold">{totalEffluent}</span>
                        </div>
                    </div>

                    {/* Pressures */}
                    <div className="col-span-1 space-y-0.5">
                        <label className="text-[9px] text-red-500 block">动脉压 PA</label>
                        <input type="number" value={pArterial} onChange={e=>setPArterial(Number(e.target.value))} className="w-full p-0.5 text-[9px] border border-gray-200 rounded bg-white text-center"/>
                    </div>
                    
                    <div className="col-span-1 space-y-0.5">
                         <label className="text-[9px] text-blue-500 block">静脉压 PV</label>
                         <input type="number" value={pVenous} onChange={e=>setPVenous(Number(e.target.value))} className="w-full p-0.5 text-[9px] border border-gray-200 rounded bg-white text-center"/>
                    </div>

                    <div className="col-span-1 space-y-0.5">
                         <label className="text-[9px] text-indigo-500 block">滤器压 Pbf</label>
                         <input type="number" value={pPreFilter} onChange={e=>setPPreFilter(Number(e.target.value))} className="w-full p-0.5 text-[9px] border border-gray-200 rounded bg-white text-center"/>
                    </div>

                    <div className="col-span-1 space-y-0.5">
                        <label className="text-[9px] text-purple-700 block font-bold">TMP</label>
                        <input type="number" value={tmp} onChange={e=>setTmp(Number(e.target.value))} className="w-full p-0.5 text-[9px] border border-gray-200 rounded bg-white text-center font-bold"/>
                    </div>
                </div>
            </div>

            {/* Anticoagulation & Labs */}
            <div className="space-y-2 pt-2 border-t border-gray-200">
                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase"><FlaskConical size={10}/> 抗凝 & 血气</div>
                
                {/* Anticoagulation Specifics */}
                {anticoagulation === 'CitrateCa' && (
                    <div className="flex flex-col gap-2 bg-teal-50/30 p-2 rounded border border-teal-100">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-teal-700">4% 枸橼酸 (ml/h)</label>
                                <input type="number" value={citrateFlow} onChange={e=>setCitrateFlow(Number(e.target.value))} className="w-full p-0.5 text-xs border border-teal-200 rounded bg-white"/>
                                <div className="text-[8px] text-teal-600 text-right">{citrateDose.toFixed(2)} mmol/L血</div>
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-[9px] font-bold text-blue-700">10% 钙剂 (ml/h)</label>
                                <input type="number" value={calciumFlow} onChange={e=>setCalciumFlow(Number(e.target.value))} className="w-full p-0.5 text-xs border border-blue-200 rounded bg-white"/>
                                <div className="text-[8px] text-blue-600 text-right">{calciumDose.toFixed(2)} mmol/L液</div>
                            </div>
                        </div>
                        
                        {/* Preset Dosage Buttons */}
                        <div className="flex items-center gap-2 text-[9px]">
                            <span className="text-gray-500">常用剂量(mmol/L):</span>
                            {[2.8, 3.0, 3.2].map(dose => (
                                <button 
                                  key={dose} 
                                  onClick={() => setCitrateByDose(dose)}
                                  className="px-2 py-0.5 bg-white border border-teal-300 text-teal-700 rounded hover:bg-teal-50 shadow-sm"
                                >
                                  {dose.toFixed(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {anticoagulation === 'Heparin' && <div className="flex gap-2"><div className="flex-1"><label className="text-[9px]">肝素 U/h</label><input type="number" value={heparinRateAbs} onChange={e=>setHeparinRateAbs(Number(e.target.value))} className="w-full p-0.5 border border-gray-200 rounded bg-white text-xs"/></div><div className="flex-1"><label className="text-[9px]">APTT s</label><input type="number" value={aptt} onChange={e=>setAptt(Number(e.target.value))} className="w-full p-0.5 border border-gray-200 rounded bg-white text-xs"/></div></div>}
                
                {/* Lab Inputs - Forced White Background */}
                <div className="grid grid-cols-4 gap-2 bg-gray-100/50 p-2 rounded">
                    <div><label className="text-[9px] text-gray-500">pH</label><input type="number" step="0.01" value={ph} onChange={e=>setPh(Number(e.target.value))} className={`w-full p-0.5 text-[10px] border border-gray-200 rounded bg-white ${ph < 7.35 || ph > 7.45 ? 'text-red-700 font-bold' : ''}`}/></div>
                    <div><label className="text-[9px] text-gray-500">pO2</label><input type="number" step="1" value={pO2} onChange={e=>setPO2(Number(e.target.value))} className="w-full p-0.5 text-[10px] border border-gray-200 rounded bg-white"/></div>
                    <div><label className="text-[9px] text-gray-500">pCO2</label><input type="number" step="1" value={pCO2} onChange={e=>setPCO2(Number(e.target.value))} className="w-full p-0.5 text-[10px] border border-gray-200 rounded bg-white"/></div>
                    <div><label className="text-[9px] text-gray-500">BE</label><input type="number" step="1" value={be} onChange={e=>setBe(Number(e.target.value))} className="w-full p-0.5 text-[10px] border border-gray-200 rounded bg-white"/></div>
                    
                    <div><label className="text-[9px] text-gray-500">HCO3</label><input type="number" step="0.1" value={hco3} onChange={e=>setHco3(Number(e.target.value))} className="w-full p-0.5 text-[10px] border border-gray-200 rounded bg-white"/></div>
                    <div><label className="text-[9px] text-gray-500">Lac</label><input type="number" step="0.1" value={lac} onChange={e=>setLac(Number(e.target.value))} className={`w-full p-0.5 text-[10px] border border-gray-200 rounded bg-white ${lac>2?'text-yellow-700 font-bold':''}`}/></div>
                    
                    {anticoagulation === 'CitrateCa' && <>
                        <div><label className="text-[9px] text-teal-600">滤后Ca</label><input type="number" step="0.01" value={postFilterCa} onChange={e=>setPostFilterCa(Number(e.target.value))} className="w-full p-0.5 text-[10px] border border-gray-200 rounded bg-white"/></div>
                        <div><label className="text-[9px] text-blue-600">外周Ca</label><input type="number" step="0.01" value={peripheralCa} onChange={e=>setPeripheralCa(Number(e.target.value))} className="w-full p-0.5 text-[10px] border border-gray-200 rounded bg-white"/></div>
                        <div className="col-span-2 flex items-end gap-1">
                            <div className="flex-1">
                                <label className="text-[9px] text-gray-500 flex items-center justify-between">
                                    总Ca 
                                    <button onClick={() => setHasTCa(!hasTCa)} className="text-[8px] text-blue-500 underline">
                                        {hasTCa ? '有' : '无'}
                                    </button>
                                </label>
                                {hasTCa ? (
                                    <input type="number" step="0.01" value={tCa} onChange={e=>setTCa(Number(e.target.value))} className="w-full p-0.5 text-[10px] border border-gray-200 rounded bg-white"/>
                                ) : (
                                    <div className="w-full p-0.5 text-[10px] border border-gray-200 rounded bg-gray-50 text-gray-400 text-center">N/A</div>
                                )}
                            </div>
                        </div>
                    </>}
                </div>
            </div>

            {/* Analysis Box */}
            <div className={`p-2 rounded border flex gap-2 items-start text-[10px] leading-relaxed whitespace-pre-wrap transition-colors ${isAnalysisWarning || isPressureWarning ? 'bg-red-50 border-red-200 text-red-800' : 'bg-indigo-50 border-indigo-100 text-indigo-900'}`}>
               <FileText className={`w-3 h-3 shrink-0 mt-0.5 ${isAnalysisWarning ? 'text-red-600' : 'text-indigo-600'}`} />
               <div>
                  <div className="font-bold mb-0.5">智能分析与建议:</div>
                  {isPressureWarning && <div className="mb-1">{pressureRecommendation}</div>}
                  {analysisRecommendation}
               </div>
            </div>
        </div>
      </div>

      {/* --- Diagram (SVG) --- */}
      <div 
        className="flex-1 bg-white overflow-hidden cursor-move relative border-t border-gray-200 shadow-inner"
        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      >
        {/* Zoom Controls Overlay */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1 bg-white/90 p-1.5 rounded-lg shadow border border-gray-200 z-10">
           <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-1 hover:bg-gray-100 rounded text-gray-600"><ZoomIn size={16}/></button>
           <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1 hover:bg-gray-100 rounded text-gray-600"><ZoomOut size={16}/></button>
           <button onClick={() => { setScale(1); setPosition({x:0, y:0}); }} className="p-1 hover:bg-gray-100 rounded text-gray-600"><RotateCcw size={16}/></button>
        </div>

        <svg 
           ref={svgRef}
           viewBox="0 0 500 800" 
           className="w-full h-full select-none"
           style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: 'center' }}
        >
          <style>
             {`
               @keyframes spin {
                 from { transform: rotate(0deg); }
                 to { transform: rotate(360deg); }
               }
             `}
          </style>
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            
            {/* Improved Dialyzer Gradient */}
            <linearGradient id="dialyzerBody" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{stopColor:'#f1f5f9', stopOpacity:1}} />
                <stop offset="20%" style={{stopColor:'#cbd5e1', stopOpacity:1}} />
                <stop offset="50%" style={{stopColor:'#f8fafc', stopOpacity:1}} />
                <stop offset="80%" style={{stopColor:'#cbd5e1', stopOpacity:1}} />
                <stop offset="100%" style={{stopColor:'#f1f5f9', stopOpacity:1}} />
            </linearGradient>
            
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
               <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
            </marker>
          </defs>

          {/* 1. Vascular Access (Arterial In) */}
          <g onClick={() => handleInteraction('access')} className="cursor-pointer transition-opacity" style={{ opacity: getOpacity('access') }}>
            <path d="M 250 780 L 250 720" fill="none" stroke={getStrokeColor('access', '#ef4444')} strokeWidth="8" strokeLinecap="round" />
            <path d="M 250 720 C 250 720 150 700 150 600" fill="none" stroke={getStrokeColor('access', '#ef4444')} strokeWidth="6" />
            <path d="M 150 600 L 150 500" fill="none" stroke={getStrokeColor('access', '#ef4444')} strokeWidth="6" />
            
            {/* PA Sensor */}
            <circle cx="250" cy="720" r="12" fill="white" stroke="#ef4444" strokeWidth="2" />
            <text x="265" y="725" fontSize="12" fill="#64748b" fontWeight="bold">PA</text>
            {isRiskLowQb && <AlertTriangle x="242" y="712" size={16} className="text-red-500 animate-pulse" />}
          </g>

          {/* 2. Blood Pump */}
          <g onClick={() => handleInteraction('pump')} className="cursor-pointer transition-opacity" style={{ opacity: getOpacity('pump') }}>
             <circle cx="150" cy="450" r="35" fill="white" stroke={getStrokeColor('pump', '#ef4444')} strokeWidth="4" />
             <g style={{ transformOrigin: '150px 450px', animation: `spin ${30000/Math.max(qb, 50)}ms linear infinite` }}>
               <path d="M 150 425 L 150 475 M 125 450 L 175 450" stroke="#ef4444" strokeWidth="4" />
               <circle cx="150" cy="450" r="5" fill="#ef4444" />
             </g>
             <text x="100" y="455" fontSize="12" fill="#64748b" textAnchor="end">Blood Pump</text>
          </g>

          {/* 3. Pre-Filter Line & Anticoagulant */}
          <g>
            <path d="M 150 415 L 150 300" fill="none" stroke="#ef4444" strokeWidth="6" />
            <circle cx="150" cy="350" r="12" fill="white" stroke="#ef4444" strokeWidth="2" />
            <text x="120" y="355" fontSize="12" fill="#64748b">Pbf</text>

            <g onClick={() => handleInteraction('anticoagulantPump')} className="cursor-pointer">
               <path d="M 150 400 L 100 400" fill="none" stroke="#14b8a6" strokeWidth="3" strokeDasharray="4 4" />
               <rect x="70" y="385" width="30" height="30" rx="4" fill="white" stroke="#14b8a6" strokeWidth="2" />
               <Syringe x="75" y="390" size={20} color="#14b8a6" />
               <text x="70" y="380" fontSize="10" fill="#14b8a6">{anticoagulation === 'CitrateCa' ? 'Citrate' : (anticoagulation === 'Heparin' ? 'Heparin' : 'Med')}</text>
               {anticoagulation !== 'None' && <circle cx="125" cy="400" r="3" fill="#14b8a6" className="animate-ping" />}
            </g>
          </g>

          {/* 4. Filter (Dialyzer) - IMPROVED SVG */}
          <g onClick={() => handleInteraction('dialyzer')} className="cursor-pointer transition-opacity" style={{ opacity: getOpacity('dialyzer') }}>
             {/* Filter Body (Cylinder) */}
             <rect x="200" y="220" width="80" height="180" rx="4" fill="url(#dialyzerBody)" stroke={getStrokeColor('dialyzer', '#94a3b8')} strokeWidth="2" />
             
             {/* Top Header (Arterial In) */}
             <path d="M 200 220 L 280 220 L 270 200 L 210 200 Z" fill="#fee2e2" stroke="#ef4444" strokeWidth="2" />
             <path d="M 240 200 L 240 180" fill="none" stroke="#ef4444" strokeWidth="6" /> 
             {/* Connecting Pre-filter line to header */}
             <path d="M 150 300 C 150 180 240 180 240 180" fill="none" stroke="#ef4444" strokeWidth="6" />

             {/* Bottom Header (Venous Out) */}
             <path d="M 200 400 L 280 400 L 270 420 L 210 420 Z" fill="#e0f2fe" stroke="#3b82f6" strokeWidth="2" />
             <path d="M 240 420 L 240 440" fill="none" stroke="#3b82f6" strokeWidth="6" />
             
             {/* Internal Fibers (Stylized) */}
             <g opacity="0.4">
                <line x1="220" y1="225" x2="220" y2="395" stroke="#ef4444" strokeWidth="2" />
                <line x1="230" y1="225" x2="230" y2="395" stroke="#ef4444" strokeWidth="2" />
                <line x1="240" y1="225" x2="240" y2="395" stroke="#ef4444" strokeWidth="2" />
                <line x1="250" y1="225" x2="250" y2="395" stroke="#ef4444" strokeWidth="2" />
                <line x1="260" y1="225" x2="260" y2="395" stroke="#ef4444" strokeWidth="2" />
             </g>

             {/* Side Ports (Dialysate/Waste) */}
             <circle cx="280" cy="250" r="8" fill="#fef3c7" stroke="#d97706" strokeWidth="2" /> {/* Waste Port */}
             <circle cx="280" cy="370" r="8" fill="#d1fae5" stroke="#059669" strokeWidth="2" /> {/* Dialysate Port */}

             {/* Warnings */}
             {isRiskHighFF && <AlertTriangle x="225" y="290" size={30} className="text-red-600 animate-bounce" />}
             {isEfficiencyReduced && <text x="210" y="310" fontSize="14" fill="#f59e0b" fontWeight="bold">Efficiency↓</text>}
             <text x="300" y="240" fontSize="12" fill="#64748b">TMP {tmp}</text>
          </g>

          {/* 5. Replacement Fluid (Purple) */}
          <g onClick={() => handleInteraction('replacement')} className="cursor-pointer">
             {/* Line logic */}
             {dilution === 'Pre' ? (
                <path d="M 350 100 L 350 150 L 150 150 L 150 300" fill="none" stroke="#a855f7" strokeWidth="3" strokeDasharray="5,5" className="animate-pulse" />
             ) : (
                // Post dilution into venous chamber
                <path d="M 350 100 L 350 150 L 400 150 L 400 550 L 350 550" fill="none" stroke="#a855f7" strokeWidth="3" strokeDasharray="5,5" className="animate-pulse" />
             )}
             
             {/* Replacement Pump */}
             <circle cx="350" cy="120" r="15" fill="white" stroke="#a855f7" strokeWidth="2" />
             <g style={{ transformOrigin: '350px 120px', animation: `spin ${30000/Math.max(qRep, 50)}ms linear infinite` }}>
               <path d="M 350 110 L 350 130" stroke="#a855f7" strokeWidth="2" />
               <path d="M 340 120 L 360 120" stroke="#a855f7" strokeWidth="2" />
             </g>
             <text x="370" y="125" fontSize="10" fill="#a855f7">Rep Pump</text>
          </g>

          {/* 6. Dialysate (CVVHDF only - Green) */}
          {mode === 'CVVHDF' && (
             <g onClick={() => handleInteraction('dialysateIn')}>
                {/* Connects to Bottom Side Port (280, 370) */}
                <path d="M 450 370 L 288 370" fill="none" stroke="#10b981" strokeWidth="4" markerEnd="url(#arrow)" />
                {/* Dialysate Pump */}
                <circle cx="400" cy="370" r="15" fill="white" stroke="#10b981" strokeWidth="2" />
                <g style={{ transformOrigin: '400px 370px', animation: `spin ${30000/Math.max(qD, 50)}ms linear infinite` }}>
                   <path d="M 400 360 L 400 380" stroke="#10b981" strokeWidth="2" />
                   <path d="M 390 370 L 410 370" stroke="#10b981" strokeWidth="2" />
                </g>
                <text x="400" y="350" fontSize="10" fill="#10b981" textAnchor="middle">Dialysate</text>
             </g>
          )}

          {/* 7. Effluent / Waste (Yellow/Orange) - IMPROVED CURVE */}
          <g onClick={() => handleInteraction('waste')}>
             {/* Connects from Top Side Port (280, 250) curving down to pump */}
             <path d="M 288 250 C 350 250 350 300 300 320 C 250 340 100 340 100 340" fill="none" stroke="#f59e0b" strokeWidth="4" />
             <path d="M 100 340 L 50 340" fill="none" stroke="#f59e0b" strokeWidth="4" />
             
             {/* Effluent Pump - Redesigned to sit on the line properly */}
             <circle cx="100" cy="340" r="16" fill="white" stroke="#f59e0b" strokeWidth="2" />
             <g style={{ transformOrigin: '100px 340px', animation: `spin ${30000/Math.max(totalEffluent, 50)}ms linear infinite` }}>
                 <circle cx="100" cy="340" r="3" fill="#f59e0b" />
                 <path d="M 100 328 L 100 352" stroke="#f59e0b" strokeWidth="2" />
                 <path d="M 88 340 L 112 340" stroke="#f59e0b" strokeWidth="2" />
             </g>
             <text x="100" y="370" fontSize="10" fill="#f59e0b" textAnchor="middle">Waste Pump</text>
          </g>

          {/* 8. Venous Line & Chamber (Blue) */}
          <g onClick={() => handleInteraction('chamber')} className="cursor-pointer transition-opacity" style={{ opacity: getOpacity('chamber') }}>
             {/* Line from Filter Bottom Header (240, 440) to Chamber */}
             <path d="M 240 440 C 240 500 350 500 350 600" fill="none" stroke={getStrokeColor('chamber', '#3b82f6')} strokeWidth="6" />
             
             {/* Venous Chamber */}
             <rect x="330" y="600" width="40" height="80" rx="4" fill="white" stroke={getStrokeColor('chamber', '#3b82f6')} strokeWidth="3" />
             {/* Blood Level */}
             <rect x="332" y="640" width="36" height="38" rx="2" fill="#3b82f6" fillOpacity="0.8" />
             
             {/* Line from Chamber to Patient */}
             <path d="M 350 680 L 350 780" fill="none" stroke={getStrokeColor('chamber', '#3b82f6')} strokeWidth="6" />

             {/* PV Sensor */}
             <circle cx="380" cy="620" r="12" fill="white" stroke="#3b82f6" strokeWidth="2" />
             <text x="400" y="625" fontSize="12" fill="#64748b" fontWeight="bold">PV</text>
             {pVenous > 150 && <AlertTriangle x="372" y="612" size={16} className="text-red-500 animate-pulse" />}

             {/* Calcium Infusion (Post-filter) */}
             {anticoagulation === 'CitrateCa' && (
                <g onClick={(e) => { e.stopPropagation(); handleInteraction('calciumPump'); }}>
                  <path d="M 400 700 L 350 700" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="4 4" />
                  <rect x="400" y="685" width="30" height="30" rx="4" fill="white" stroke="#2563eb" strokeWidth="2" />
                  <text x="405" y="705" fontSize="10" fill="#2563eb" fontWeight="bold">Ca++</text>
                </g>
             )}
          </g>

          {/* Gradients */}
          <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#e0f2fe', stopOpacity: 1 }} />
          </linearGradient>
        </svg>
      </div>
    </div>
  );
};

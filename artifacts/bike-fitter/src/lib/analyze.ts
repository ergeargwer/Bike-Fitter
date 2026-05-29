import { PoseAngles, AngleAnalysis } from "./types";

export function analyzeAngles(angles: PoseAngles, bikeType: string): AngleAnalysis[] {
  const torsoRange = bikeType === 'triathlon' ? { min: 15, max: 25 } : { min: 35, max: 45 };
  
  const checks = [
    { 
      name: '膝蓋角度', 
      detected: angles.kneeAngle, 
      min: 140, max: 150,
      lowSug: '座高偏低，建議上調 5–10mm', 
      highSug: '座高偏高，建議下調 5–10mm', 
      okSug: '膝蓋角度在建議範圍內' 
    },
    { 
      name: '髖部角度', 
      detected: angles.hipAngle, 
      min: 45, max: 60,
      lowSug: '髖部角度偏小，坐姿尚可', 
      highSug: '髖部角度過大，建議後移坐墊或提高把手', 
      okSug: '髖部角度在建議範圍內' 
    },
    { 
      name: '軀幹角度', 
      detected: angles.torsoAngle, 
      min: torsoRange.min, max: torsoRange.max,
      lowSug: '軀幹過於前傾，建議提高把手', 
      highSug: '軀幹角度偏大，建議降低把手落差', 
      okSug: '軀幹角度在建議範圍內' 
    },
    { 
      name: '手肘角度', 
      detected: angles.elbowAngle, 
      min: 150, max: 165,
      lowSug: '手肘角度偏小，建議縮短上管長度', 
      highSug: '手肘過度伸直，建議加長龍頭', 
      okSug: '手肘角度在建議範圍內' 
    },
  ];
  
  return checks.map(c => {
    let status: "符合" | "偏高" | "偏低";
    let suggestion: string;
    
    if (c.detected >= c.min && c.detected <= c.max) { 
      status = '符合'; 
      suggestion = c.okSug; 
    } else if (c.detected < c.min) { 
      status = '偏低'; 
      suggestion = c.lowSug; 
    } else { 
      status = '偏高'; 
      suggestion = c.highSug; 
    }
    
    return { 
      name: c.name, 
      detected: c.detected, 
      recommendedMin: c.min, 
      recommendedMax: c.max, 
      status, 
      suggestion 
    };
  });
}

export function calcAngle(A: {x:number,y:number}, B: {x:number,y:number}, C: {x:number,y:number}): number {
  const AB = { x: A.x - B.x, y: A.y - B.y };
  const CB = { x: C.x - B.x, y: C.y - B.y };
  const dot = AB.x * CB.x + AB.y * CB.y;
  const magAB = Math.sqrt(AB.x**2 + AB.y**2);
  const magCB = Math.sqrt(CB.x**2 + CB.y**2);
  return Math.round(Math.acos(dot / (magAB * magCB)) * (180 / Math.PI));
}


import { useEffect,useState } from 'react'; import { AccessibilityInfo } from 'react-native'; export function useReducedMotion(){const [reduced,setReduced]=useState(false);useEffect(()=>{AccessibilityInfo.isReduceMotionEnabled().then(setReduced);const s=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>s.remove()},[]);return reduced}

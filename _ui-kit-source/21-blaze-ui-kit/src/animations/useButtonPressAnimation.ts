
import { useAnimatedStyle,useSharedValue,withTiming } from 'react-native-reanimated'; export function useButtonPressAnimation(){const scale=useSharedValue(1);return{onPressIn:()=>{scale.value=withTiming(.97,{duration:90})},onPressOut:()=>{scale.value=withTiming(1,{duration:130})},animatedStyle:useAnimatedStyle(()=>({transform:[{scale:scale.value}]}))}}

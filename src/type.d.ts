interface DanmakuColor {
    r: number;
    g: number;
    b: number;
}
interface DanmakuMeta {
    name: string;
    url: string;
}
interface Danmaku {
    text: string;
    time: number;
    mode: string;
    size: number;
    color: DanmakuColor;
    bottom: boolean;
    meta: DanmakuMeta;
    layout: any;
}

interface ExtOption {
    resolutionX: number //canvas width for drawing danmaku (px)
    resolutionY: number //canvas height for drawing danmaku (px)
    bottomReserved: number //reserved height at bottom for drawing danmaku (px)
    fontFamily: string //danmaku font family
    fontSize: number //danmaku font size (ratio)
    textSpace: number //space between danmaku (px)
    rtlDuration: number //duration of right to left moving danmaku appeared on screen (s)
    fixDuration: number //duration of keep bottom / top danmaku appeared on screen (s)
    maxDelay: number // maxinum amount of allowed delay (s)
    textOpacity: number // opacity of text, in range of [0, 1]
    maxOverlap: number // maxinum layers of danmaku
}

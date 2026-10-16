import type {ComponentType} from 'react';
export const TracePanel: ComponentType<{load:(args:{traceId?:string;callId?:string})=>Promise<any>;heading?:boolean}>;

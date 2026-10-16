import type {ReactNode} from 'react';
export type EvidenceUpdate={id:string;title:string};
export type EvidenceVersion={id:string;label:string;text:string;turn:number};
export type EvidenceItem={id:string;title:string;description:string;complete:boolean;scopeNote?:{text:string;struck:boolean;updatedTurn:number};sections:{id:string;title:string;text:string;turn:number;updatedTurn?:number;versions?:EvidenceVersion[]}[];acquiredTurn:number};
export function EvidenceDialog(props:{items?:EvidenceItem[];onClose:()=>void;dark?:boolean;loading?:boolean;error?:string;initialId?:string}):ReactNode;
export function EvidenceUpdateNotice(props:{items?:EvidenceUpdate[];onOpen:(id?:string)=>void;dark?:boolean}):ReactNode;

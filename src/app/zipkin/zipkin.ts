import { Injectable, Inject} from '@angular/core';

import { Http, Headers, HTTP_PROVIDERS } from '@angular/http';

export interface Endpoint {
    serviceName: string;
    ipv4: string;
    port: number;
}

export interface Annotation {
    timestamp: any;
    value: string;
    endpoint: Endpoint;
}

export interface BinaryAnnotation {
    key: string;
    value: string;
    endpoint: Endpoint;
}

export interface Span {
    traceId: string;
    id: string;
    name: string;
    parentId: string;
    timestamp: number;
    duration: number;
    annotations: Annotation[];
    binaryAnnotations: BinaryAnnotation[];
    parent: Span;
    children: Span[];
    expanded: boolean;
}

export type Trace = Span[];

export type Traces = Trace[]

@Injectable()
export class ZipkinService {
    traces: Traces;
    spans: { [id: string]: Span };
    services: string[];

    constructor( @Inject(Http) private http: Http) {

    }

    getServices() {
         this
            .http
            .get("http://localhost:9411/api/v1/services", {})
            .subscribe(res => {
                this.services = <string[]>(res.json());
                this.services.push("[any]");
                this.services.sort();
            });
    }

    getTraces(serviceName: string, startDate: Date, endDate: Date, limit: number, minDuration: string | number) {
        let endTs = startDate.getTime();
        let lookback = endTs - endDate.getTime();

        var uri = `http://localhost:9411/api/v1/traces?endTs=${endTs}&lookback=${lookback}&annotationQuery=&limit=${limit}&minDuration=${minDuration}&spanName=all`;
        if (serviceName != undefined && serviceName != "[any]") {
            uri += `&serviceName=${serviceName}`
        }

        this.spans = {};
        console.log(uri);
        this
            .http
            .get(uri, {})
            .subscribe(res => {
                this.traces = <Traces>(res.json());

                //flat map all spans
                this.traces.forEach(trace => {
                    trace.forEach(span => {
                        this.spans[span.id] = span;
                        span.expanded = true;
                        span.children = [];
                    });
                });

                //Map parents to children
                for (let key in this.spans) {
                    var span = this.spans[key];
                    if (span.parentId) {
                        span.parent = this.spans[span.parentId];
                        span.parent.children.push(span);
                    }
                    else {
                        span.parent = null;
                    }
                }

                this.traces.forEach(trace => {
                    let root = trace[0];
                    root.expanded = false;
                    trace.length = 0;
                    this.sortTrace(root,trace);
                });
            });
    }

    sortTrace(span : Span, trace: Trace) {
        trace.push(span);
        span.children.sort((a,b) => a.annotations[0].timestamp - b.annotations[0].timestamp);
        span.children.forEach(child => {
            this.sortTrace(child, trace);
        });
    }
}


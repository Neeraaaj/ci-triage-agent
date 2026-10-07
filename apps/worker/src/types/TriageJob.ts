type TriageJob = {
    deliveryId: string;
    installationId: number;
    repo: string;
    runId: number;
    headSha: string;
    prNumbers: number[];
};

export { TriageJob };
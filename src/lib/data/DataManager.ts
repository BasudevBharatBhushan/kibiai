// In-memory data manager for chart datasets, pkeys, results, and logs
export class InMemoryDataManager {
  private datasets: Record<number, any[]> = {};
  private pkeys: Record<number, string[]> = {};
  private results: Record<string, any> = {};
  private logs: string[] = [];

  storeDataset(fetchOrder: number, data: any[]): void {
    this.datasets[fetchOrder] = data;
  }

  storePkeys(fetchOrder: number, pkeys: string[]): void {
    this.pkeys[fetchOrder] = pkeys;
  }

  getDataset(fetchOrder: number): any[] | null {
    return this.datasets[fetchOrder] || null;
  }

  getPkeys(fetchOrder: number): string[] | null {
    return this.pkeys[fetchOrder] || null;
  }

  saveResult(resultType: string, data: any): void {
    this.results[resultType] = data;
  }

  getResult(resultType: string): any | null {
    return this.results[resultType] || null;
  }

  addLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.push(`[${timestamp}] ${message}`);
  }

  getLogs(): string[] {
    return this.logs;
  }

  clearAll(): void {
    this.datasets = {};
    this.pkeys = {};
    this.results = {};
    this.logs = [];
  }
}

import { FileSystem } from '@rushstack/node-core-library'
import path from 'path'
import * as Diff from 'diff'

import { ITestReport } from './generate-report'
import { logger } from './logger'

export class HtmlReportGenerator {
  private _report: ITestReport

  public constructor(report: ITestReport) {
    this._report = report
  }

  public async generateHtmlReport(reportDirectory: string): Promise<string> {
    const htmlContent = this._generateHtmlContent()
    const timestamp = this._report.timestamp.replace(/:/g, '-')
    const htmlFilename = `test-report-${timestamp}.html`
    const htmlPath = path.join(reportDirectory, htmlFilename)

    await FileSystem.writeFileAsync(htmlPath, htmlContent)
    logger.writeLine(`HTML test report saved to: ${htmlPath}`)

    return htmlPath
  }

  private _generateHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Testing Framework Report - ${this._formatTimestamp()}</title>
    <style>
        ${this._getStyles()}
    </style>
</head>
<body>
    <div class="container">
        ${this._generateHeader()}
        ${this._generateSummary()}
        ${this._generateTestResults()}
    </div>
    <script>
        ${this._getJavaScript()}
    </script>
</body>
</html>`
  }

  private _getStyles(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .header .subtitle {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        .summary {
            background: white;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .summary h2 {
            margin-bottom: 20px;
            color: #2c3e50;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .stat-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #3498db;
        }

        .stat-card.success {
            border-left-color: #27ae60;
        }

        .stat-card.failure {
            border-left-color: #e74c3c;
        }

        .stat-card .value {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .stat-card.success .value {
            color: #27ae60;
        }

        .stat-card.failure .value {
            color: #e74c3c;
        }

        .config-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #9b59b6;
        }

        .config-info h3 {
            margin-bottom: 10px;
            color: #8e44ad;
        }

        .test-results {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .test-case {
            border: 1px solid #e1e8ed;
            border-radius: 8px;
            margin-bottom: 20px;
            overflow: hidden;
        }

        .test-case-header {
            background: #f8f9fa;
            padding: 15px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .test-case-header:hover {
            background: #e9ecef;
        }

        .test-case-title {
            font-weight: 600;
            flex: 1;
        }

        .test-case-status {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 500;
        }

        .status-badge.pass {
            background: #d4edda;
            color: #155724;
        }

        .status-badge.fail {
            background: #f8d7da;
            color: #721c24;
        }

        .expand-icon {
            font-size: 1.2rem;
            transition: transform 0.2s;
        }

        .test-case.expanded .expand-icon {
            transform: rotate(180deg);
        }

        .test-case-content {
            display: none;
            padding: 20px;
            border-top: 1px solid #e1e8ed;
        }

        .test-case.expanded .test-case-content {
            display: block;
        }

        .model-results {
            margin-bottom: 20px;
        }

        .model-header {
            background: #f1f3f4;
            padding: 10px 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-weight: 600;
        }

        .round-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 10px;
            margin-bottom: 15px;
        }

        .round-result {
            padding: 8px;
            text-align: center;
            border-radius: 4px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 2px solid transparent;
        }

        .round-result:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .round-result.pass {
            background: #d4edda;
            color: #155724;
        }

        .round-result.fail {
            background: #f8d7da;
            color: #721c24;
        }

        .round-result.active {
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
        }

        .error-details {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 15px;
            border-radius: 6px;
            margin-top: 10px;
        }

        .error-details h4 {
            color: #856404;
            margin-bottom: 10px;
        }

        .tool-execution {
            background: #e3f2fd;
            border-radius: 6px;
            margin-top: 10px;
            border: 1px solid #bbdefb;
        }

        .collapsible-header {
            padding: 15px;
            cursor: pointer;
            background: rgba(255,255,255,0.5);
            border-bottom: 1px solid #bbdefb;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .collapsible-header:hover {
            background: rgba(255,255,255,0.8);
        }

        .collapsible-content {
            padding: 15px;
            display: none;
        }

        .collapsible-content.expanded {
            display: block;
        }

        .collapse-icon {
            transition: transform 0.2s ease;
        }

        .collapsed .collapse-icon {
            transform: rotate(-90deg);
        }

        .tool-execution h4 {
            color: #1565c0;
            margin-bottom: 10px;
        }

        .tool-usage-comparison {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            margin-top: 10px;
            padding: 15px;
        }

        .comparison-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 10px;
        }

        .view-toggle {
            margin-bottom: 15px;
        }

        .view-toggle button {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 8px 16px;
            margin-right: 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
        }

        .view-toggle button.active {
            background: #007bff;
            color: white;
            border-color: #007bff;
        }

        .view-toggle button:hover {
            background: #e9ecef;
        }

        .view-toggle button.active:hover {
            background: #0056b3;
        }

        .comparison-view, .diff-view {
            display: none;
        }

        .comparison-view.active, .diff-view.active {
            display: block;
        }

        .expected-column, .actual-column {
            background: white;
            border-radius: 4px;
            padding: 15px;
            border: 1px solid #e9ecef;
        }

        .expected-column h5 {
            color: #28a745;
            margin-bottom: 10px;
            font-size: 0.9rem;
        }

        .actual-column h5 {
            color: #007bff;
            margin-bottom: 10px;
            font-size: 0.9rem;
        }

        .code-block.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .diff-container {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            overflow: hidden;
        }

        .diff-line {
            padding: 2px 8px;
            font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
            font-size: 0.85rem;
            line-height: 1.4;
            white-space: pre-wrap;
            margin: 0;
            border: none;
        }

        .diff-added {
            background-color: #d4edda;
            color: #155724;
        }

        .diff-removed {
            background-color: #f8d7da;
            color: #721c24;
        }

        .diff-context {
            background-color: #f8f9fa;
            color: #6c757d;
        }

        .diff-summary {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 10px;
            font-size: 0.9rem;
        }

        .diff-summary.match {
            background: #d4edda;
            border-color: #c3e6cb;
            color: #155724;
        }

        .diff-summary.mismatch {
            background: #f8d7da;
            border-color: #f5c6cb;
            color: #721c24;
        }

        .final-message {
            background: #f3e5f5;
            padding: 15px;
            border-radius: 6px;
            margin-top: 10px;
        }

        .final-message h4 {
            color: #7b1fa2;
            margin-bottom: 10px;
        }

        .code-block {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 12px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.9rem;
            overflow-x: auto;
            white-space: pre-wrap;
        }

        .filters {
            margin-bottom: 20px;
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }

        .filter-button {
            padding: 8px 16px;
            border: 1px solid #dee2e6;
            border-radius: 20px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
        }

        .filter-button:hover {
            background: #f8f9fa;
        }

        .filter-button.active {
            background: #007bff;
            color: white;
            border-color: #007bff;
        }

        .hidden {
            display: none !important;
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .stats-grid {
                grid-template-columns: 1fr 1fr;
            }
            
            .comparison-grid {
                grid-template-columns: 1fr;
                gap: 10px;
            }
            
            .round-grid {
                grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
            }
        }
    `
  }

  private _generateHeader(): string {
    return `
        <div class="header">
            <h1>🧪 MCP Testing Framework Report</h1>
            <div class="subtitle">Generated on ${this._formatTimestamp()}</div>
        </div>
    `
  }

  private _generateSummary(): string {
    const config = this._report.config
    const summary = this._report.summary

    return `
        <div class="summary">
            <h2>📊 Test Summary</h2>
            <div class="stats-grid">
                <div class="stat-card ${summary.allPass ? 'success' : 'failure'}">
                    <div class="value">${summary.allPass ? '✅' : '❌'}</div>
                    <div class="label">Overall Status</div>
                </div>
                <div class="stat-card success">
                    <div class="value">${summary.passedTests}</div>
                    <div class="label">Passed Tests</div>
                </div>
                <div class="stat-card failure">
                    <div class="value">${summary.failedTests}</div>
                    <div class="label">Failed Tests</div>
                </div>
                <div class="stat-card">
                    <div class="value">${summary.totalTests}</div>
                    <div class="label">Total Tests</div>
                </div>
                ${
                  summary.toolExecutionTests
                    ? `
                <div class="stat-card">
                    <div class="value">${summary.toolExecutionTests}</div>
                    <div class="label">Tool Executions</div>
                </div>
                `
                    : ''
                }
                ${
                  summary.gradedTests
                    ? `
                <div class="stat-card">
                    <div class="value">${summary.gradedTests}</div>
                    <div class="label">AI Graded</div>
                </div>
                `
                    : ''
                }
            </div>
            
            <div class="config-info">
                <h3>🔧 Configuration</h3>
                <p><strong>Test Rounds:</strong> ${config.testRound}</p>
                <p><strong>Pass Threshold:</strong> ${(config.passThreshold * 100).toFixed(1)}%</p>
                <p><strong>Models:</strong> ${config.modelsToTest.join(', ')}</p>
                <p><strong>Tool Execution:</strong> ${config.executeTools ? '✅ Enabled' : '❌ Disabled'}</p>
                ${config.gradingPrompt ? '<p><strong>AI Grading:</strong> ✅ Enabled</p>' : ''}
            </div>
        </div>
    `
  }

  private _generateTestResults(): string {
    const filters = this._generateFilters()
    const testCases = this._report.results
      .map((result, index) => this._generateTestCase(result, index))
      .join('')

    return `
        <div class="test-results">
            <h2>🔍 Test Results</h2>
            ${filters}
            <div class="test-cases">
                ${testCases}
            </div>
        </div>
    `
  }

  private _generateFilters(): string {
    return `
        <div class="filters">
            <button class="filter-button active" onclick="filterTests('all')">All Tests</button>
            <button class="filter-button" onclick="filterTests('passed')">✅ Passed Only</button>
            <button class="filter-button" onclick="filterTests('failed')">❌ Failed Only</button>
            <button class="filter-button" onclick="filterTests('tool-execution')">🔧 Tool Execution</button>
            <button class="filter-button" onclick="filterTests('ai-graded')">🤖 AI Graded</button>
        </div>
    `
  }

  private _generateTestCase(result: any, index: number): string {
    const hasToolExecution = result.modelResults.some((mr: any) =>
      mr.details.some((d: any) => d.toolExecutionResult),
    )
    const hasAiGrading = result.modelResults.some((mr: any) =>
      mr.details.some((d: any) => d.gradingResult),
    )

    const overallPassed = result.modelResults.every(
      (mr: any) => mr.passRate >= 0.8,
    )

    const classes = [
      'test-case',
      overallPassed ? 'test-passed' : 'test-failed',
      hasToolExecution ? 'has-tool-execution' : '',
      hasAiGrading ? 'has-ai-grading' : '',
    ]
      .filter(Boolean)
      .join(' ')

    return `
        <div class="${classes}" data-test-index="${index}">
            <div class="test-case-header" onclick="toggleTestCase(${index})">
                <div class="test-case-title">
                    <strong>Test ${index + 1}:</strong> ${this._escapeHtml(result.prompt)}
                </div>
                <div class="test-case-status">
                    <span class="status-badge ${overallPassed ? 'pass' : 'fail'}">
                        ${overallPassed ? '✅ PASS' : '❌ FAIL'}
                    </span>
                    ${hasToolExecution ? '<span class="status-badge">🔧 Tool</span>' : ''}
                    ${hasAiGrading ? '<span class="status-badge">🤖 AI</span>' : ''}
                    <span class="expand-icon">▼</span>
                </div>
            </div>
            <div class="test-case-content">
                ${
                  result.expectedResults
                    ? `
                    <div class="expected-results">
                        <h4>🎯 Expected Results</h4>
                        <div class="code-block">${this._escapeHtml(result.expectedResults.content)}</div>
                    </div>
                `
                    : ''
                }
                ${this._generateModelResults(result.modelResults, result.expectedToolUsage)}
            </div>
        </div>
    `
  }

  private _generateModelResults(
    modelResults: any[],
    expectedToolUsage: any,
  ): string {
    return modelResults
      .map(
        (modelResult, modelIndex) => `
        <div class="model-results">
            <div class="model-header">
                🤖 ${modelResult.model} - Pass Rate: ${(modelResult.passRate * 100).toFixed(1)}%
            </div>
            ${this._generateRoundResults(modelResult.details, expectedToolUsage)}
        </div>
    `,
      )
      .join('')
  }

  private _generateRoundResults(
    details: any[],
    expectedToolUsage: any,
  ): string {
    const testId = Math.random().toString(36).substr(2, 9)

    const roundGrid = `
        <div class="round-grid">
            ${details
              .map(
                (detail, roundIndex) => `
                <div class="round-result ${detail.passed ? 'pass' : 'fail'} ${roundIndex === 0 ? 'active' : ''}" 
                     onclick="showRoundDetail('${testId}', ${roundIndex})"
                     title="Round ${roundIndex + 1}: ${detail.passed ? 'PASS' : 'FAIL'}${detail.error ? ' - ' + detail.error : ''}${!detail.passed && detail.response && expectedToolUsage ? ' - Tool usage mismatch' : ''}">
                    Round ${roundIndex + 1}
                </div>
            `,
              )
              .join('')}
        </div>
    `

    const roundDetails = details
      .map(
        (detail, roundIndex) => `
        <div class="round-detail" id="round-${testId}-${roundIndex}" style="${roundIndex === 0 ? 'display: block' : 'display: none'}">
            ${this._generateDetailedResult(detail, expectedToolUsage)}
        </div>
    `,
      )
      .join('')

    return roundGrid + roundDetails
  }

  private _generateDetailedResult(detail: any, expectedToolUsage: any): string {
    let content = ''

    if (detail.error) {
      content += `
        <div class="error-details">
            <h4>❌ Error Details</h4>
            <div class="code-block">${this._escapeHtml(detail.error)}</div>
        </div>
      `
    }

    // Tool Usage Comparison with Diff (Expected vs Actual)
    if (detail.response || expectedToolUsage) {
      const diffResult = this._generateDiff(expectedToolUsage, detail.response)
      const viewId = Math.random().toString(36).substr(2, 9)

      content += `
        <div class="tool-usage-comparison">
            <h4>🔧 Tool Usage Comparison</h4>
            <div class="diff-summary ${diffResult.isMatch ? 'match' : 'mismatch'}">
                ${diffResult.summary}
            </div>
            
            ${
              !diffResult.isMatch
                ? `
                <div class="view-toggle">
                    <button class="active" onclick="switchView('${viewId}', 'comparison')">📊 Side-by-Side</button>
                    <button onclick="switchView('${viewId}', 'diff')">🔍 Diff View</button>
                </div>
            `
                : ''
            }
            
            <div class="comparison-view ${!diffResult.isMatch ? 'active' : ''}" id="comparison-${viewId}">
                <div class="comparison-grid">
                    <div class="expected-column">
                        <h5>📋 Expected Tool Usage</h5>
                        <div class="code-block">${JSON.stringify(expectedToolUsage, null, 2)}</div>
                    </div>
                    <div class="actual-column">
                        <h5>📤 Actual Tool Usage (Model Response)</h5>
                        ${
                          detail.response
                            ? `<div class="code-block">${JSON.stringify(detail.response, null, 2)}</div>`
                            : `<div class="code-block error">No response generated</div>`
                        }
                    </div>
                </div>
            </div>
            
            ${
              !diffResult.isMatch
                ? `
                <div class="diff-view" id="diff-${viewId}">
                    <h5>🔍 Detailed Diff (- Expected / + Actual)</h5>
                    ${diffResult.diffHtml}
                </div>
            `
                : diffResult.isMatch
                  ? `
                <div class="comparison-view active">
                    <div class="comparison-grid">
                        <div class="expected-column">
                            <h5>📋 Expected Tool Usage</h5>
                            <div class="code-block">${JSON.stringify(expectedToolUsage, null, 2)}</div>
                        </div>
                        <div class="actual-column">
                            <h5>📤 Actual Tool Usage (Model Response)</h5>
                            <div class="code-block">${JSON.stringify(detail.response, null, 2)}</div>
                        </div>
                    </div>
                </div>
            `
                  : ''
            }
        </div>
      `
    }

    if (detail.toolExecutionResult) {
      const collapsibleId = Math.random().toString(36).substr(2, 9)
      content += `
        <div class="tool-execution collapsed">
            <div class="collapsible-header" onclick="toggleCollapsible('${collapsibleId}')">
                <span>🔧 Tool Execution Result</span>
                <span class="collapse-icon">▼</span>
            </div>
            <div class="collapsible-content" id="collapsible-${collapsibleId}">
                <div class="code-block">${JSON.stringify(detail.toolExecutionResult, null, 2)}</div>
            </div>
        </div>
      `
    }

    if (detail.gradingResult) {
      content += `
        <div class="final-message">
            <h4>🤖 AI Grading: ${detail.gradingResult.grade}</h4>
            <p><strong>Reasoning:</strong> ${this._escapeHtml(detail.gradingResult.reasoning)}</p>
            ${
              detail.gradingResult.finalMessage
                ? `
                <p><strong>Final Message:</strong></p>
                <div class="code-block">${this._escapeHtml(detail.gradingResult.finalMessage)}</div>
            `
                : ''
            }
        </div>
      `
    }

    return content
  }

  private _getJavaScript(): string {
    return `
        function toggleTestCase(index) {
            const testCase = document.querySelector('[data-test-index="' + index + '"]');
            testCase.classList.toggle('expanded');
        }

        function filterTests(filter) {
            // Update active button
            document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');

            const testCases = document.querySelectorAll('.test-case');
            
            testCases.forEach(testCase => {
                let show = false;
                
                switch(filter) {
                    case 'all':
                        show = true;
                        break;
                    case 'passed':
                        show = testCase.classList.contains('test-passed');
                        break;
                    case 'failed':
                        show = testCase.classList.contains('test-failed');
                        break;
                    case 'tool-execution':
                        show = testCase.classList.contains('has-tool-execution');
                        break;
                    case 'ai-graded':
                        show = testCase.classList.contains('has-ai-grading');
                        break;
                }
                
                testCase.style.display = show ? 'block' : 'none';
            });
        }

        function showRoundDetail(testId, roundIndex) {
            // Hide all round details for this test
            const allDetails = document.querySelectorAll('[id^="round-' + testId + '-"]');
            allDetails.forEach(detail => detail.style.display = 'none');
            
            // Show selected round detail
            const selectedDetail = document.getElementById('round-' + testId + '-' + roundIndex);
            if (selectedDetail) {
                selectedDetail.style.display = 'block';
            }
            
            // Update active state for round buttons
            const roundButtons = document.querySelectorAll('.round-result');
            const testElement = event.target.closest('.model-results');
            if (testElement) {
                const buttons = testElement.querySelectorAll('.round-result');
                buttons.forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');
            }
        }

        function toggleCollapsible(id) {
            const content = document.getElementById('collapsible-' + id);
            const container = content.closest('.tool-execution');
            
            if (content.classList.contains('expanded')) {
                content.classList.remove('expanded');
                container.classList.add('collapsed');
            } else {
                content.classList.add('expanded');
                container.classList.remove('collapsed');
            }
        }

        function switchView(viewId, viewType) {
            // Hide all views for this comparison
            const comparisonView = document.getElementById('comparison-' + viewId);
            const diffView = document.getElementById('diff-' + viewId);
            
            comparisonView.classList.remove('active');
            diffView.classList.remove('active');
            
            // Show selected view
            if (viewType === 'comparison') {
                comparisonView.classList.add('active');
            } else {
                diffView.classList.add('active');
            }
            
            // Update button states
            const container = comparisonView.closest('.tool-usage-comparison');
            const buttons = container.querySelectorAll('.view-toggle button');
            buttons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
        }

        // Auto-expand failed tests
        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('.test-case.test-failed').forEach((testCase, index) => {
                if (index < 3) { // Only expand first 3 failed tests
                    testCase.classList.add('expanded');
                }
            });
        });
    `
  }

  private _formatTimestamp(): string {
    try {
      // The timestamp has colons replaced with dashes for filename safety
      // Example: 2024-01-01T12-30-45.123Z -> 2024-01-01T12:30:45.123Z
      // We need to restore colons in the time part only
      let isoTimestamp = this._report.timestamp

      // Find the 'T' separator and restore colons after it
      const tIndex = isoTimestamp.indexOf('T')
      if (tIndex !== -1) {
        const datePart = isoTimestamp.substring(0, tIndex + 1)
        const timePart = isoTimestamp.substring(tIndex + 1)
        // Replace the first two dashes in the time part with colons
        const fixedTimePart = timePart.replace(/-/g, (match, offset) => {
          // First two dashes should be colons (HH-MM-SS -> HH:MM:SS)
          if (offset < 6) {
            // Within HH-MM-SS part
            return ':'
          }
          return match
        })
        isoTimestamp = datePart + fixedTimePart
      }

      const date = new Date(isoTimestamp)
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date')
      }

      return date.toLocaleString()
    } catch (error) {
      // Fallback: try to create a more readable format from the timestamp
      return this._report.timestamp
        .replace('T', ' at ')
        .replace(/\.\d{3}Z$/, '')
    }
  }

  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  private _generateDiff(
    expected: any,
    actual: any,
  ): { isMatch: boolean; diffHtml: string; summary: string } {
    const expectedStr = JSON.stringify(expected, null, 2)
    const actualStr = actual
      ? JSON.stringify(actual, null, 2)
      : 'No response generated'

    // Check if they match exactly
    const isMatch = JSON.stringify(expected) === JSON.stringify(actual)

    if (isMatch) {
      return {
        isMatch: true,
        diffHtml: `<div class="diff-container">
          <div class="diff-line diff-context">${this._escapeHtml(expectedStr)}</div>
        </div>`,
        summary: '✅ Tool usage matches exactly',
      }
    }

    // Generate line-by-line diff
    const diff = Diff.diffLines(expectedStr, actualStr)

    let diffHtml = '<div class="diff-container">'
    let addedLines = 0
    let removedLines = 0

    diff.forEach((part) => {
      const lines = part.value.split('\n')
      lines.forEach((line, index) => {
        // Skip empty lines at the end
        if (index === lines.length - 1 && line === '') return

        if (part.added) {
          diffHtml += `<div class="diff-line diff-added">+ ${this._escapeHtml(line)}</div>`
          addedLines++
        } else if (part.removed) {
          diffHtml += `<div class="diff-line diff-removed">- ${this._escapeHtml(line)}</div>`
          removedLines++
        } else {
          diffHtml += `<div class="diff-line diff-context">  ${this._escapeHtml(line)}</div>`
        }
      })
    })

    diffHtml += '</div>'

    const summary = `❌ Tool usage differs: ${removedLines} line(s) removed, ${addedLines} line(s) added`

    return {
      isMatch: false,
      diffHtml,
      summary,
    }
  }
}

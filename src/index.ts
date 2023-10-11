import type {Capabilities, Services} from '@wdio/types';
import type WdioQunitService from './types';
import logger from '@wdio/logger';

const log = logger('wdio-qunit-service');

/**
 * Use QUnit events to get test results when QUnit run has ended
 */
async function qunitHooks(browserInstance: WebdriverIO.Browser): Promise<WdioQunitService.RunEndDetails> {
  log.debug('Waiting for QUnit to load...');
  await browser.waitUntil(() => browser.execute(() => !!window?.QUnit), {
    timeout: 60000,
    timeoutMsg: 'QUnit took too long to load.',
    interval: 100
  });
  log.debug('Waiting for QUnit runEnd event...');
  return browserInstance.executeAsync(function(done) {
    QUnit.on('runEnd', function(qunitRunEnd) {
      done(qunitRunEnd);
    });

    // Check whether tests have already been completed, QUnit event runEnd won't be triggered
    if (QUnit.config?.started && QUnit.config?.queue?.length === 0) {
      const qunitResultsFromConfigModules: WdioQunitService.RunEndDetails = {
        childSuites: []
      };
      for (const qunitChildSuite of QUnit.config.modules) {
        qunitResultsFromConfigModules.childSuites.push({
          name: qunitChildSuite.name,
          tests: qunitChildSuite.suiteReport.tests
        });
      }
      done(qunitResultsFromConfigModules);
    }
  });
}

/**
 * Generate test cases from QUnit results
 */
function generateTestCases(qunitResults: WdioQunitService.RunEndDetails): void {
  log.debug('Generating test cases...');
  for (const qunitChildSuite of qunitResults.childSuites) {
    log.debug(`Creating "describe" ${qunitChildSuite.name}`);
    describe(qunitChildSuite.name, () => {
      for (const qunitTest of qunitChildSuite.tests) {
        log.debug(`Creating "it" ${qunitTest.name}`);
        it(qunitTest.name, () => {
          for (const qunitAssertion of qunitTest.assertions) {
            log.debug(`Creating "expect" ${qunitTest.name} - ${qunitAssertion?.message}`);
            expect(qunitAssertion.passed).toEqual(true);
          }
        });
      }
    });
  }
}

export default class QUnitService implements Services.ServiceInstance {
  /**
   * `serviceOptions` contains all options specific to the service
   */
  constructor() {}

  /**
   * Gets executed before test execution begins, add custom command to get QUnit results
   */
  before(capabilities: Capabilities.RemoteCapability, specs: string[], browserInstance: WebdriverIO.Browser): void {
    browserInstance.addCommand('getQUnitResults', this.getQUnitResults.bind(browserInstance));
  }

  async getQUnitResults(this: WebdriverIO.Browser): Promise<WdioQunitService.RunEndDetails> {
    log.info('Executing qunitHooks...');
    const qunitResults = await qunitHooks(this); // eslint-disable-line no-invalid-this
    generateTestCases(qunitResults);
    return qunitResults;
  }
}

export {WdioQunitService};

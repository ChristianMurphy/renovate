import type { Stats } from 'node:fs';
import os from 'node:os';
import { codeBlock } from 'common-tags';
import { fs, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import {
  extractGradleVersion,
  getJavaConstraint,
  getJvmConfiguration,
  gradleWrapperFileName,
  prepareGradleCommand,
} from './utils';

const platform = jest.spyOn(os, 'platform');
jest.mock('../../../util/fs');

describe('modules/manager/gradle-wrapper/util', () => {
  beforeEach(() => GlobalConfig.reset());

  describe('getJavaConstraint()', () => {
    it('return ^8.0.0 for global mode', async () => {
      expect(await getJavaConstraint('4', '')).toBe('^8.0.0');
    });

    it('return ^11.0.0 for docker mode and undefined gradle', async () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(await getJavaConstraint('', '')).toBe('^11.0.0');
    });

    it('return ^8.0.0 for docker gradle < 5', async () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(await getJavaConstraint('4.9', '')).toBe('^8.0.0');
    });

    it('return ^11.0.0 for docker gradle >=5 && <7', async () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(await getJavaConstraint('6.0', '')).toBe('^11.0.0');
    });

    it('return ^16.0.0 for docker gradle >= 7', async () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(await getJavaConstraint('7.0.1', '')).toBe('^16.0.0');
    });

    it('return ^17.0.0 for docker gradle >= 7.3', async () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(await getJavaConstraint('7.3.0', '')).toBe('^17.0.0');
      expect(await getJavaConstraint('8.0.1', '')).toBe('^17.0.0');
    });

    it('returns toolChainVersion constraint if daemon JVM configured', async () => {
      const daemonJvm = codeBlock`
        #This file is generated by updateDaemonJvm
        toolchainVersion=999
      `;
      fs.readLocalFile.mockResolvedValue(daemonJvm);
      expect(await getJavaConstraint('8.8', './gradlew')).toBe('^999.0.0');
    });
  });

  describe('getJvmConfiguration', () => {
    it('extracts toolChainVersion value', async () => {
      const daemonJvm = codeBlock`
        #This file is generated by updateDaemonJvm
        toolchainVersion=21
      `;
      fs.readLocalFile.mockResolvedValue(daemonJvm);
      expect(await getJvmConfiguration('')).toBe('21');
    });

    it('returns null if gradle-daemon-jvm.properties file not found', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      expect(await getJvmConfiguration('sub/gradlew')).toBeNull();
      expect(fs.readLocalFile).toHaveBeenCalledWith(
        'sub/gradle/gradle-daemon-jvm.properties',
        'utf8',
      );
    });
  });

  describe('extractGradleVersion()', () => {
    it('works for undefined', () => {
      // TODO #22198
      expect(extractGradleVersion(undefined as never)).toBeNull();
    });
  });

  describe('gradleWrapperFileName()', () => {
    it('works on windows', () => {
      platform.mockReturnValueOnce('win32');
      expect(gradleWrapperFileName()).toBe('gradlew.bat');
    });

    it('works on linux', () => {
      platform.mockReturnValueOnce('linux');
      expect(gradleWrapperFileName()).toBe('./gradlew');
    });
  });

  describe('prepareGradleCommand', () => {
    it('works', async () => {
      platform.mockReturnValue('linux');
      fs.statLocalFile.mockResolvedValue(
        partial<Stats>({
          isFile: () => true,
          mode: 0o550,
        }),
      );
      expect(await prepareGradleCommand('./gradlew')).toBe('./gradlew');
    });

    it('returns null', async () => {
      fs.statLocalFile.mockResolvedValue(
        partial<Stats>({
          isFile: () => false,
        }),
      );
      expect(await prepareGradleCommand('./gradlew')).toBeNull();
    });
  });
});

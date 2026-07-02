import { describe, expect, test } from 'vitest';
import { buildServiceVersionsText } from './serviceVersions';

describe('ServiceConnectionsDashboard version snapshot', () => {
  test('formats frontend, service, and package versions in support-friendly order', () => {
    const text = buildServiceVersionsText(
      [
        {
          key: 'content-control',
          version: '1.118.0',
          packages: {
            dataProvider: { version: '1.106.0' },
            dgSkinsPackage: { version: '0.24' },
          },
        },
        { key: 'json-to-word', version: '1.0.5' },
        { key: 'api-gate', version: '2.28.0' },
      ],
      '1.17.0',
    );

    expect(text).toBe(
      [
        'DocGen Frontend: v1.17.0',
        'API Gate Version: 2.28.0',
        'Content Control version: 1.118.0',
        'JSON to Word Version: 1.0.5',
        'Data Provider: 1.106.0',
        'DG Skins: 0.24',
      ].join('\n'),
    );
  });

  test('uses unknown when a service or package version is missing', () => {
    const text = buildServiceVersionsText([{ key: 'content-control' }], '');

    expect(text).toBe(
      [
        'DocGen Frontend: vunknown',
        'API Gate Version: unknown',
        'Content Control version: unknown',
        'JSON to Word Version: unknown',
        'Data Provider: unknown',
        'DG Skins: unknown',
      ].join('\n'),
    );
  });
});

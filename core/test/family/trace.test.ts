import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { traceAncestry } from '../../src/family/trace.ts';

function seed(derivedDir: string, record: string, content: string): void {
  writeFileSync(join(derivedDir, `${record}.yml`), content, 'utf-8');
}

test('traceAncestry: self only when no parents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fam-'));
  try {
    mkdirSync(dir, { recursive: true });
    seed(dir, 'I1',
      `record: I1\nname: Alice\nbirth: null\ndeath: null\nparents: []\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    const tree = traceAncestry({ rootRecord: 'I1', derivedDir: dir });
    assert.ok(tree);
    assert.equal(tree!.self.name, 'Alice');
    assert.equal(tree!.self.label, 'Self');
    assert.deepEqual(tree!.ancestors, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('traceAncestry: labels father/mother at gen 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fam-'));
  try {
    seed(dir, 'I1',
      `record: I1\nname: Child\nbirth: null\ndeath: null\nparents:\n  - { record: I2, name: Dad, role: father }\n  - { record: I3, name: Mom, role: mother }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I2',
      `record: I2\nname: Dad\nbirth: null\ndeath: null\nparents: []\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I3',
      `record: I3\nname: Mom\nbirth: null\ndeath: null\nparents: []\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    const tree = traceAncestry({ rootRecord: 'I1', derivedDir: dir })!;
    assert.equal(tree.ancestors.length, 2);
    const dad = tree.ancestors.find(a => a.record === 'I2')!;
    const mom = tree.ancestors.find(a => a.record === 'I3')!;
    assert.equal(dad.label, 'Father');
    assert.equal(dad.side, 'paternal');
    assert.equal(mom.label, 'Mother');
    assert.equal(mom.side, 'maternal');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('traceAncestry: labels grandparents with side prefix', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fam-'));
  try {
    seed(dir, 'I1',
      `record: I1\nname: Child\nbirth: null\ndeath: null\nparents:\n  - { record: I2, name: Dad, role: father }\n  - { record: I3, name: Mom, role: mother }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I2',
      `record: I2\nname: Dad\nbirth: null\ndeath: null\nparents:\n  - { record: I4, name: PaternalGrandpa, role: father }\n  - { record: I5, name: PaternalGrandma, role: mother }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I3',
      `record: I3\nname: Mom\nbirth: null\ndeath: null\nparents:\n  - { record: I6, name: MaternalGrandpa, role: father }\n  - { record: I7, name: MaternalGrandma, role: mother }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    for (const r of ['I4','I5','I6','I7']) {
      seed(dir, r, `record: ${r}\nname: ${r}\nbirth: null\ndeath: null\nparents: []\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    }
    const tree = traceAncestry({ rootRecord: 'I1', derivedDir: dir })!;
    const grands = tree.ancestors.filter(a => a.generation === 2);
    assert.equal(grands.length, 4);
    const pgf = tree.ancestors.find(a => a.record === 'I4')!;
    const pgm = tree.ancestors.find(a => a.record === 'I5')!;
    const mgf = tree.ancestors.find(a => a.record === 'I6')!;
    const mgm = tree.ancestors.find(a => a.record === 'I7')!;
    assert.equal(pgf.label, 'Paternal grandfather');
    assert.equal(pgm.label, 'Paternal grandmother');
    assert.equal(mgf.label, 'Maternal grandfather');
    assert.equal(mgm.label, 'Maternal grandmother');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('traceAncestry: great-grandparents labelled with prefix', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fam-'));
  try {
    seed(dir, 'I1', `record: I1\nname: Child\nbirth: null\ndeath: null\nparents:\n  - { record: I2, name: Dad, role: father }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I2', `record: I2\nname: Dad\nbirth: null\ndeath: null\nparents:\n  - { record: I4, name: PGF, role: father }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I4', `record: I4\nname: PGF\nbirth: null\ndeath: null\nparents:\n  - { record: I8, name: PGGF, role: father }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I8', `record: I8\nname: PGGF\nbirth: null\ndeath: null\nparents: []\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    const tree = traceAncestry({ rootRecord: 'I1', derivedDir: dir })!;
    const pggf = tree.ancestors.find(a => a.record === 'I8')!;
    assert.equal(pggf.generation, 3);
    assert.equal(pggf.label, 'Paternal great-grandfather');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('traceAncestry: returns null for unknown root', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fam-'));
  try {
    assert.equal(traceAncestry({ rootRecord: 'I999', derivedDir: dir }), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('traceAncestry: maxDepth caps the walk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fam-'));
  try {
    seed(dir, 'I1', `record: I1\nname: Child\nbirth: null\ndeath: null\nparents:\n  - { record: I2, name: Dad, role: father }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I2', `record: I2\nname: Dad\nbirth: null\ndeath: null\nparents:\n  - { record: I4, name: PGF, role: father }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I4', `record: I4\nname: PGF\nbirth: null\ndeath: null\nparents:\n  - { record: I8, name: PGGF, role: father }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I8', `record: I8\nname: PGGF\nbirth: null\ndeath: null\nparents: []\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    const tree = traceAncestry({ rootRecord: 'I1', derivedDir: dir, maxDepth: 1 })!;
    assert.equal(tree.ancestors.length, 1, 'only direct parent at maxDepth=1');
    assert.equal(tree.ancestors[0]!.record, 'I2');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('traceAncestry: keeps the same ancestor on separate family lines', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fam-'));
  try {
    seed(dir, 'I1', `record: I1\nname: Child\nbirth: null\ndeath: null\nparents:\n  - { record: I2, name: Dad, role: father }\n  - { record: I3, name: Mom, role: mother }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I2', `record: I2\nname: Dad\nbirth: null\ndeath: null\nparents:\n  - { record: I4, name: Shared Grandpa, role: father }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I3', `record: I3\nname: Mom\nbirth: null\ndeath: null\nparents:\n  - { record: I4, name: Shared Grandpa, role: father }\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    seed(dir, 'I4', `record: I4\nname: Shared Grandpa\nbirth: null\ndeath: null\nparents: []\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    const tree = traceAncestry({ rootRecord: 'I1', derivedDir: dir })!;
    const shared = tree.ancestors.filter(a => a.record === 'I4');
    assert.equal(shared.length, 2);
    assert.deepEqual(shared.map(a => a.side).sort(), ['maternal', 'paternal']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

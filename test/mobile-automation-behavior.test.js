const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, '../mobile/app.js'), 'utf8');
function section(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Production function boundary missing: ${start}`);
  return source.slice(from, to);
}
// Execute the actual production routing, validation and lifecycle functions. Only DOM,
// storage, timers and the Android bridge are substituted; no copied algorithm or regex-only assertions.
function harness() {
  const env = {
    crypto: { randomUUID }, URL, Date, console,
    bridgeStatus: { state: 'idle' }, calls: [], alerts: [], prompts: [], renders: [], intervals: new Map(),
    persistChats() {}, persistAgent() {},
    renderMessages(preserve) { env.renders.push(preserve); },
    alert(text) { env.alerts.push(text); }, confirm(text) { env.prompts.push(text); return true; },
    setInterval(fn) { const id = randomUUID(); env.intervals.set(id, fn); return id; },
    clearInterval(id) { env.intervals.delete(id); },
    async executePhoneAction(name, args) {
      env.calls.push({ name, args: structuredClone(args) });
      if (env.rejectDispatch) throw new Error('Native dispatch rejected');
      env.bridgeStatus = { taskId: args.taskId, state: 'running', step: 1, total: args.steps.length, completedSteps: 0, message: '执行中' };
    },
  };
  env.window = { NeoAIAndroid: {
    getAutomationTaskStatus: () => JSON.stringify(env.bridgeStatus),
    cancelAutomationTask: (id) => { if (env.bridgeStatus.taskId !== id) return false; env.bridgeStatus.state = 'cancelled'; env.bridgeStatus.message = '用户停止'; return true; },
  } };
  vm.createContext(env);
  vm.runInContext([
    section('const ACTIONS =', 'let config ='),
    'let agentState = JSON.parse(JSON.stringify(defaultAgentState)); let chats = []; let automationPoll = 0; let requestSequence = 0;',
    section('function toolEnabled(', 'function validChat('),
    section('function describeTool(', 'function renderAll('),
    section('function validateAssistantForRequest(', 'async function executePhoneAction('),
  ].join('\n'), env);
  env.run = (code) => vm.runInContext(code, env);
  env.read = (code) => JSON.parse(JSON.stringify(env.run(code)));
  env.addTask = (name = 'app_task') => env.run(`chats = [{ id: 'chat', workspaceId: 'qa', messages: [{id:'message', tool:{name:${JSON.stringify(name)}, args:{goal:'测试',steps:[{action:'wait',milliseconds:200}]}, executed:false}}]}];`);
  return env;
}

test('named app search preserves model task instead of silently routing to browser', () => {
  const h = harness();
  const result = h.read(`validateAssistantForRequest({reply:'确认后搜索',tool:{name:'app_task',args:{goal:'搜索本地AI',steps:[{action:'open_app',app:'bilibili'},{action:'wait_for_text',text:'搜索'}]}}},'打开B站搜索本地AI')`);
  assert.equal(result.tool.name, 'app_task');
  assert.equal(result.tool.args.steps[0].app, 'bilibili');
  assert.equal(h.run(`validateTool({name:'browser_search',args:{query:'本地AI'}},'打开B站搜索本地AI')`), null);
});

test('multi-app plan is not downgraded to the first launch', () => {
  const h = harness();
  assert.equal(h.run(`deterministicToolForRequest('打开微信，然后打开B站')`), null);
  assert.equal(h.run(`deterministicToolForRequest('打开Wi-Fi设置，然后返回')`), null);
});

test('plain browser search and Wi-Fi route deterministically; stale map is discarded', () => {
  const h = harness();
  assert.equal(h.read(`deterministicToolForRequest('搜索本地AI')`).tool.name, 'browser_search');
  const result = h.read(`validateAssistantForRequest({reply:'请提供地图地点',tool:{name:'map',args:{}}},'帮我打开手机的Wi-Fi设置')`);
  assert.equal(result.tool.name, 'wifi_settings');
  assert.doesNotMatch(result.reply, /地图/);
});

test('disabled named app is explicitly rejected rather than sent to browser', () => {
  const h = harness(); h.run(`agentState.enabledAppPlugins.bilibili = false`);
  const result = h.read(`deterministicToolForRequest('打开B站搜索本地AI')`);
  assert.equal(result.tool, null); assert.match(result.reply, /已关闭/);
});

test('invalid, over-limit or unsafe plans fail entirely; valid predecessors are not salvaged', () => {
  const h = harness();
  for (const plan of [
    [{ action: 'open_app', app: 'unknown' }, { action: 'click_text', text: '搜索' }],
    [{ action: 'open_app', app: 'bilibili' }, { action: 'shell' }],
    [{ action: 'click_text', text: '搜索' }],
    [{ action: 'open_app', app: 'bilibili' }, { action: 'home' }, { action: 'click_text', text: '搜索' }],
    [{ action: 'open_app', app: 'bilibili' }, { action: 'click_text', texts: ['搜索', '发送'] }],
    [{ action: 'open_app', app: 'bilibili' }, { action: 'input_text', text: '验证码1234' }],
    [{ action: 'open_app', app: 'bilibili' }, { action: 'click_text', text: 'x'.repeat(81) }],
    [{ action: 'wait', milliseconds: -1 }],
    [{ action: 'wait', milliseconds: '800' }],
    Array.from({ length: 33 }, () => ({ action: 'wait' })),
  ]) assert.deepEqual(h.read(`sanitizeAutomationSteps(${JSON.stringify(plan)},32)`), []);
});

test('valid plan retains every step and text alternative', () => {
  const h = harness();
  const plan = [{action:'open_app',app:'bilibili'},{action:'wait_for_text',texts:['搜索','首页']},{action:'click_text',text:'搜索'},{action:'input_text',text:'本地AI'},{action:'wait',milliseconds:200}];
  assert.deepEqual(h.read(`sanitizeAutomationSteps(${JSON.stringify(plan)},32)`), plan);
});

test('system app sub-permissions and required long-task goal are enforced', () => {
  const h = harness(); h.run(`agentState.enabledTools.system_settings = false`);
  assert.deepEqual(h.read(`sanitizeAutomationSteps([{action:'open_app',app:'settings'}],32)`), []);
  assert.equal(h.run(`validateTool({name:'app_task',args:{steps:[{action:'wait'}]}},'执行任务')`), null);
});

test('plan is revalidated immediately before dispatch after plugin disabled', async () => {
  const h = harness(); h.addTask();
  h.run(`chats[0].messages[0].tool.args.steps=[{action:'open_app',app:'bilibili'}]; agentState.enabledAppPlugins.bilibili=false;`);
  await h.run(`executeSuggestedAction('chat','message')`);
  assert.equal(h.calls.length, 0); assert.match(h.alerts[0], /整项任务未执行/);
});

test('short task accepted is not completed until native completion; terminal log exactly once', async () => {
  const h = harness(); h.addTask('app_sequence');
  await h.run(`executeSuggestedAction('chat','message')`);
  assert.equal(h.run(`chats[0].messages[0].tool.executed`), false);
  assert.equal(h.run('agentState.activity.length'), 0);
  assert.equal(h.intervals.size, 1);
  h.bridgeStatus = { ...h.bridgeStatus, state: 'complete', step: 1, completedSteps: 1, message: '步骤已执行' };
  h.run('syncAutomationStatus(); syncAutomationStatus();');
  assert.equal(h.run(`chats[0].messages[0].tool.executed`), true);
  assert.equal(h.run('agentState.activity.length'), 1);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.run(`chats[0].messages[0].tool.progressTotal`), 1);
});

test('unchanged status does not rerender or force scroll', async () => {
  const h = harness(); h.addTask(); await h.run(`executeSuggestedAction('chat','message')`);
  h.renders.length = 0;
  h.run('syncAutomationStatus(); syncAutomationStatus();');
  assert.equal(h.renders.length, 0);
  h.bridgeStatus.message = '等待界面'; h.run('syncAutomationStatus()');
  assert.deepEqual(h.renders, [true]);
});

test('failed attempt and successful retry each get their own record and id', async () => {
  const h = harness(); h.addTask(); await h.run(`executeSuggestedAction('chat','message')`);
  const oldId = h.bridgeStatus.taskId;
  h.bridgeStatus = {...h.bridgeStatus,state:'failed',completedSteps:1,message:'按钮未找到'};
  h.run('syncAutomationStatus()');
  await h.run(`executeSuggestedAction('chat','message')`);
  assert.notEqual(h.bridgeStatus.taskId, oldId);
  assert.match(h.prompts.at(-1), /上次已执行 1 步/);
  h.bridgeStatus = {...h.bridgeStatus,state:'complete',completedSteps:1}; h.run('syncAutomationStatus()');
  assert.deepEqual(h.read('agentState.activity.map(item=>item.ok)'), [false,true]);
});

test('reload polling resumes; unknown native task is marked interrupted without replay', async () => {
  const h = harness(); h.addTask(); await h.run(`executeSuggestedAction('chat','message')`);
  h.run('clearInterval(automationPoll); automationPoll=0; startAutomationPolling()');
  assert.equal(h.intervals.size, 1);
  h.bridgeStatus = {state:'idle'}; h.run('syncAutomationStatus()');
  assert.equal(h.run(`chats[0].messages[0].tool.taskState`), 'failed');
  assert.equal(h.intervals.size, 0); assert.equal(h.calls.length, 1);
});

test('user can stop short or long task; a rejected dispatch is not logged twice', async () => {
  for (const name of ['app_sequence','app_task']) {
    const h = harness(); h.addTask(name); await h.run(`executeSuggestedAction('chat','message')`);
    await h.run(`executeSuggestedAction('chat','message')`);
    assert.equal(h.run(`chats[0].messages[0].tool.taskState`), 'cancelled');
    assert.equal(h.run('agentState.activity.length'), 1);
  }
  const h = harness(); h.addTask(); h.rejectDispatch = true;
  await h.run(`executeSuggestedAction('chat','message')`); h.run('syncAutomationStatus()');
  assert.equal(h.run('agentState.activity.length'), 1);
  assert.equal(h.run(`chats[0].messages[0].tool.executed`), false);
});

const statusElement = document.querySelector("#status");
const resultElement = document.querySelector("#result");
const writesElement = document.querySelector("#writes");
const form = document.querySelector("#write-form");

async function request(path, options) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.code || `HTTP_${response.status}`);
  return body;
}

function renderWrites(writes) {
  writesElement.replaceChildren();
  if (!writes.length) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = "아직 저장된 기록이 없습니다.";
    writesElement.append(item);
    return;
  }
  for (const write of writes) {
    const item = document.createElement("li");
    const message = document.createElement("strong");
    const meta = document.createElement("small");
    message.textContent = write.message;
    meta.textContent = `#${write.id} · ${new Date(write.createdAt).toLocaleString("ko-KR")} · ${String(write.commitSha).slice(0, 12)}`;
    item.append(message, meta);
    writesElement.append(item);
  }
}

async function refresh() {
  const [info, records] = await Promise.all([request("/api/info"), request("/api/writes?limit=20")]);
  statusElement.textContent = `정상 · ${info.database.count}개 저장됨`;
  statusElement.className = "status ok";
  document.querySelector("#release").textContent = `${String(info.release.commitSha).slice(0, 12)} · ${info.release.podName}`;
  renderWrites(records.writes);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  resultElement.textContent = "저장 중";
  try {
    const message = new FormData(form).get("message");
    const response = await request("/api/writes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    resultElement.textContent = `저장 완료 · #${response.write.id}`;
    form.reset();
    await refresh();
  } catch (error) {
    resultElement.textContent = `저장 실패 · ${error.message}`;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#refresh").addEventListener("click", () => refresh().catch(showFailure));

function showFailure(error) {
  statusElement.textContent = `연결 실패 · ${error.message}`;
  statusElement.className = "status error";
}

refresh().catch(showFailure);

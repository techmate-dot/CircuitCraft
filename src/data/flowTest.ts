// Use native global fetch

async function run() {
  console.log("=== STARTING FULL END-TO-END FLOW TEST ===");

  // 1. First clarify call (vague idea)
  console.log("\n--- STEP 1: Sending vague user request ---");
  const firstClarifyRes = await fetch("http://localhost:3000/api/clarify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "I want to build a motion detector alarm" })
  });
  const clarify1 = await firstClarifyRes.json() as any;
  console.log("Response:", JSON.stringify(clarify1, null, 2));

  if (!clarify1.missing_info || clarify1.missing_info.length === 0) {
    throw new Error("First turn should return missing_info clarification questions!");
  }

  // 2. Second clarify call (responding to questions)
  console.log("\n--- STEP 2: Answering clarifying questions ---");
  const secondClarifyRes = await fetch("http://localhost:3000/api/clarify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "I want to use ESP32 and switch high-voltage loads using a relay.",
      context: [
        { role: "user", content: "I want to build a motion detector alarm" },
        { role: "assistant", content: `Goal identified: ${clarify1.goal}. Missing: ${clarify1.missing_info.map((q: any) => q.question).join('; ')}` }
      ]
    })
  });
  const clarify2 = await secondClarifyRes.json() as any;
  console.log("Response:", JSON.stringify(clarify2, null, 2));

  if (clarify2.missing_info.length > 0) {
    throw new Error("Second turn should have resolved missing_info!");
  }

  // 3. Compare call (getting architecture options)
  console.log("\n--- STEP 3: Getting architecture options ---");
  const compareRes = await fetch("http://localhost:3000/api/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent: clarify2 })
  });
  const options = await compareRes.json() as any;
  console.log("Response (Options length):", options.length);
  console.log("Option 1:", JSON.stringify(options[0], null, 2));
  console.log("Option 2:", JSON.stringify(options[1], null, 2));

  if (options.length < 2) {
    throw new Error("Compare should return exactly 2 options!");
  }

  // 4. Milestone plan call (using Option 1)
  console.log("\n--- STEP 4: Generating milestone plan for Option 1 ---");
  const planRes = await fetch("http://localhost:3000/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ option: options[0] })
  });
  const milestones = await planRes.json() as any;
  console.log("Response:", JSON.stringify(milestones, null, 2));

  if (!milestones || milestones.length === 0) {
    throw new Error("Milestones list should not be empty!");
  }

  console.log("\n=== ALL PIPELINE CHECKS PASSED SUCCESSFULLY ===");
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

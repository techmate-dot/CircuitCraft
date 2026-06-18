// Use native global fetch

async function run() {
  console.log("=== STARTING WHAT-IF FLOW TEST ===");

  // 1. Initial compare call to get Option 1
  console.log("\n--- STEP 1: Getting Option 1 with Relay_Coil ---");
  const compareRes = await fetch("http://localhost:3000/api/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: {
        goal: "Build a motion-activated alert system using an ESP32 and a relay",
        components_mentioned: ["ESP32", "PIR Sensor", "Relay_Coil"],
        missing_info: [],
        assumptions: ["Assuming USB 5V power source", "Assuming active-high signaling for the relay control"]
      }
    })
  });
  const options = await compareRes.json() as any;
  const originalOption = options[0]; // ESP32 Wi-Fi Relay Control with Relay_Coil
  console.log("Original Option components:", originalOption.components);

  // 2. Simulate the component swap: Relay_Coil -> Relay_Module (pin preserved)
  console.log("\n--- STEP 2: Swapping Relay_Coil (Pin GPIO5) -> Relay_Module ---");
  const swappedComponents = originalOption.components.map((c: string) =>
    c === "Relay_Coil (Pin GPIO5)" ? "Relay_Module (Pin GPIO5)" : c
  );
  const swappedOption = {
    ...originalOption,
    components: swappedComponents,
    label: `${originalOption.label} (Swapped: Relay_Module)`
  };
  console.log("Swapped Option components:", swappedOption.components);

  // 3. Generate plan for original Option
  console.log("\n--- STEP 3: Requesting plan for Original Option ---");
  const resPlanOrig = await fetch("http://localhost:3000/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ option: originalOption })
  });
  const planOrig = await resPlanOrig.json() as any;
  console.log("Original plan Milestone 1 description:", planOrig[0].description);

  // 4. Generate plan for Swapped Option
  console.log("\n--- STEP 4: Requesting plan for Swapped Option ---");
  const resPlanSwapped = await fetch("http://localhost:3000/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ option: swappedOption })
  });
  const planSwapped = await resPlanSwapped.json() as any;
  console.log("Swapped plan Milestone 1 description:", planSwapped[0].description);

  // 5. Verify the diff
  console.log("\n--- STEP 5: Verification & Diff Check ---");
  console.log("Original: ", planOrig[0].description);
  console.log("Swapped:  ", planSwapped[0].description);

  if (planOrig[0].description.includes("Relay Coil") && planSwapped[0].description.includes("Relay Module")) {
    console.log("\n✅ SUCCESS: The mock plan generator successfully re-planned the milestones dynamically based on swapped components!");
  } else {
    throw new Error("Milestone plan descriptions did not differ as expected!");
  }

  console.log("\n=== ALL WHAT-IF PIPELINE CHECKS PASSED SUCCESSFULLY ===");
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("=== Testing v_dashboard_overview ===");
    
    // Test 1: Try to select from the view
    console.log("\n1. Testing SELECT from v_dashboard_overview...");
    const { data, error, status, statusText } = await supabase
        .from('v_dashboard_overview')
        .select('*')
        .limit(1);
    
    console.log("Status:", status, statusText);
    
    if (error) {
        console.log("Error code:", error.code);
        console.log("Error message:", error.message);
        console.log("Error details:", error.details);
        console.log("Error hint:", error.hint);
        console.log("Full error:", JSON.stringify(error, null, 2));
    } else {
        console.log("Success! Data sample:", data);
        if (data && data.length > 0) {
            console.log("Columns:", Object.keys(data[0]).join(', '));
        }
    }
    
    // Test 2: Check if view exists in information_schema
    console.log("\n2. Checking if view exists in system...");
    const { data: viewInfo, error: viewError } = await supabase.rpc('get_view_info', { view_name: 'v_dashboard_overview' });
    
    if (viewError) {
        console.log("RPC failed (expected if function doesn't exist):", viewError.message);
    } else {
        console.log("View info:", viewInfo);
    }
}

main();

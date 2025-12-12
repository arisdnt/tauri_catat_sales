const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables manually since dotenv regex might fail on some complex values or if path is tricky
// But try standard dotenv first
dotenv.config({ path: '.env.local' });

// Fallback if dotenv file not found or vars not loaded
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log("Looking for .env.local manually...");
    try {
        const envConfig = fs.readFileSync('.env.local', 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim().replace(/^["']|["']$/g, ''); // Simple unquote
                process.env[key.trim()] = value;
            }
        });
    } catch (e) {
        console.error("Could not read .env.local", e);
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect(table) {
    console.log(`Inspecting ${table}...`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
        console.log(`Error accessing ${table}: ${error.code} - ${error.message}`);
    } else {
        if (data && data.length > 0) {
            console.log(`Columns for ${table}:`, Object.keys(data[0]).join(', '));
            // Try to determine types if possible (by inspecting value) - simplistic
            const row = data[0];
            const types = {};
            for (const k in row) {
                types[k] = typeof row[k];
            }
            console.log(`Types for ${table}:`, JSON.stringify(types));
        } else {
            console.log(`${table} exists but is empty.`);
            // Try to get structure via an impossible query that returns error with hint? No.
        }
    }
}

async function main() {
    const viewsToTest = [
        'v_dashboard_overview'
    ];

    for (const v of viewsToTest) {
        await inspect(v);
    }
}

// Also try to get the view definition if possible
async function getViewDefinition() {
    console.log("\n--- Attempting to get v_dashboard_overview definition ---");
    const { data, error } = await supabase.rpc('get_view_definition', { view_name: 'v_dashboard_overview' });
    if (error) {
        console.log("Could not get view definition via RPC:", error.message);
    } else {
        console.log("View definition:", data);
    }
}

main();
getViewDefinition();

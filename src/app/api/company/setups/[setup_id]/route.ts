import { NextRequest, NextResponse } from "next/server";
import { SetupService } from "@/services/setup.service";
import { getSession } from "@/utils/auth";

interface RouteParams {
  params: Promise<{ setup_id: string }>;
}

// GET /api/company/setups/[setup_id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "company_user" && session.accountType !== "platform_admin")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { setup_id } = await params;
    const company_id = session.companyId;

    const setup = await SetupService.getSetupById(setup_id, session.accountType === 'platform_admin' ? undefined : company_id);

    if (!setup) {
      return NextResponse.json({ success: false, error: "Setup not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, setup });
  } catch (err: any) {
    console.error("GET /api/company/setups/[id] error:", err);
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

// PUT /api/company/setups/[setup_id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "company_user" && session.accountType !== "platform_admin")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { setup_id } = await params;
    const company_id = session.companyId;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const setup = await SetupService.updateSetup(setup_id, session.accountType === 'platform_admin' ? body.company_id || company_id : company_id, body);

    return NextResponse.json({ success: true, setup });
  } catch (err: any) {
    console.error("PUT /api/company/setups/[id] error:", err);
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/company/setups/[setup_id]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "company_user" && session.accountType !== "platform_admin")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { setup_id } = await params;
    const company_id = session.companyId;

    await SetupService.deleteSetup(setup_id, session.accountType === 'platform_admin' ? "" : (company_id || ""));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/company/setups/[id] error:", err);
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

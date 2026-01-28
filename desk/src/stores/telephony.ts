import { defineStore } from "pinia";
import { call } from "frappe-ui";

interface MakeCallParams {
  number?: string;
  doctype?: string;
  docname?: string;
}

interface SetLinkDocParams {
  docname: string;
  doctype: string;
}

export const useTelephonyStore = defineStore("telephony", {
  state: () => ({
    isLoading: false,
    isCallingEnabled: false,
    isTwilioEnabled: false,
    isExotelEnabled: false,
    isPBXEnabled: false,
    defaultCallingMedium: "",
    callMethod: (params: MakeCallParams) => {},
    linkDoc: {
      doctype: "",
      docname: "",
    },
  }),
  actions: {
    setMakeCall(value: (params: MakeCallParams) => void) {
      this.callMethod = value;
    },
    setDefaultCallingMedium(value: string) {
      this.defaultCallingMedium = value;
    },
    makeCall(params: MakeCallParams) {
      this.callMethod(params);
    },
    setIsCallingEnabled(value: boolean) {
      this.isCallingEnabled = value;
    },
    setIsPBXEnabled(value: boolean) {
      this.isPBXEnabled = value;
    },
    async fetchCallIntegrationStatus() {
      try {
        this.isLoading = true;
        const data = await call("telephony.api.is_call_integration_enabled");
        this.isTwilioEnabled = Boolean(data.twilio_enabled);
        this.isExotelEnabled = Boolean(data.exotel_enabled);
        this.defaultCallingMedium = data.default_calling_medium;

        // Check PBX integration status
        try {
          const pbxData = await call("pbx_integration.api.call.is_pbx_enabled");
          this.isPBXEnabled = Boolean(pbxData.pbx_enabled && pbxData.has_extension);
        } catch (pbxError) {
          // PBX integration not available
          this.isPBXEnabled = false;
        }

        this.isCallingEnabled = this.isTwilioEnabled || this.isExotelEnabled || this.isPBXEnabled;
      } catch (error) {
        console.error("Failed to fetch call integration status:", error);
      } finally {
        this.isLoading = false;
      }
    },
    setLinkDoc(params: SetLinkDocParams) {
      this.linkDoc.docname = params.docname;
      this.linkDoc.doctype = params.doctype;
    },
  },
});

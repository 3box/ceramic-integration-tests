import { AnchorStatus } from "@ceramicnetwork/common";

async function registerChangeListener(doc: any): Promise<void> {
    return new Promise(resolve => {
        doc.on('change', () => {
            resolve()
        })
    })
}

export async function waitForAnchor(doc: any): Promise<void> {
    let onAnchorStatusChange = registerChangeListener(doc)

    while (doc.state.anchorStatus == AnchorStatus.NOT_REQUESTED ||
    doc.state.anchorStatus == AnchorStatus.PENDING ||
    doc.state.anchorStatus == AnchorStatus.PROCESSING) {
        console.log(`Waiting for anchor of document ${doc.id.toString()}, current status: ${AnchorStatus[doc.state.anchorStatus]}. Anchor scheduled at ${doc.state.anchorScheduledFor?.toString()}`)
        await onAnchorStatusChange
        onAnchorStatusChange = registerChangeListener(doc)
    }
    console.log(`anchor status reached for document ${doc.id.toString()}`)
    expect(doc.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
}
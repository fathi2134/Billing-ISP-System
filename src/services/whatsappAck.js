const { pool } = require('../config/database');

/**
 * whatsapp-web.js MessageAck: ACK_PENDING=0, ACK_SERVER=1, ACK_DEVICE=2, ACK_READ=3, ACK_PLAYED=4
 */
function attachMessageAck(client) {
  if (client.__waAckAttached) return;
  client.__waAckAttached = true;

  client.on('message_ack', async (msg, ack) => {
    try {
      const mid = msg?.id?._serialized || msg?.id;
      if (!mid || typeof mid !== 'string') return;

      const delivered = ack >= 2;
      const read = ack >= 3;

      await pool.query(
        `UPDATE whatsapp_delivery_log SET
           wa_ack_raw = ?,
           wa_delivered_at = IF(? = 1 AND wa_delivered_at IS NULL, NOW(), wa_delivered_at),
           wa_read_at = IF(? = 1 AND wa_read_at IS NULL, NOW(), wa_read_at)
         WHERE provider_message_id = ?`,
        [ack, delivered ? 1 : 0, read ? 1 : 0, mid]
      );
    } catch (e) {
      if (e?.code === 'ER_BAD_FIELD_ERROR') {
        // Kolom belum dimigrasi — tidak spam log
        return;
      }
      console.error('[WhatsApp ACK]', e.message);
    }
  });
}

module.exports = { attachMessageAck };

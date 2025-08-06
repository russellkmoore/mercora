import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
  Img,
} from '@react-email/components';
import * as React from 'react';

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface OrderData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  estimatedDelivery?: string;
}

interface OrderConfirmationEmailProps {
  orderData: OrderData;
}

export const OrderConfirmationEmail: React.FC<OrderConfirmationEmailProps> = ({
  orderData,
}) => {
  const previewText = `Order confirmation for ${orderData.orderNumber}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>Voltique</Heading>
            <Text style={tagline}>Premium Outdoor Gear</Text>
          </Section>

          {/* Order Confirmation */}
          <Section style={section}>
            <Heading as="h2" style={h2}>
              Order Confirmed!
            </Heading>
            <Text style={text}>
              Hi {orderData.customerName},
            </Text>
            <Text style={text}>
              Thank you for your order! Your gear is being prepared and will be shipped soon.
            </Text>
            
            <Section style={orderInfo}>
              <Text style={orderNumber}>
                Order #{orderData.orderNumber}
              </Text>
              {orderData.estimatedDelivery && (
                <Text style={delivery}>
                  Estimated delivery: {orderData.estimatedDelivery}
                </Text>
              )}
            </Section>
          </Section>

          {/* Order Items */}
          <Section style={section}>
            <Heading as="h3" style={h3}>
              Your Items
            </Heading>
            {orderData.items.map((item, index) => (
              <Row key={index} style={itemRow}>
                <Column style={itemImageCol}>
                  {item.imageUrl && (
                    <Img
                      src={item.imageUrl}
                      alt={item.name}
                      style={itemImage}
                    />
                  )}
                </Column>
                <Column style={itemDetailsCol}>
                  <Text style={itemName}>{item.name}</Text>
                  <Text style={itemDetails}>
                    Quantity: {item.quantity} × ${item.price.toFixed(2)}
                  </Text>
                </Column>
                <Column style={itemPriceCol}>
                  <Text style={itemPrice}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>

          {/* Order Summary */}
          <Section style={summary}>
            <Row style={summaryRow}>
              <Column>
                <Text style={summaryLabel}>Subtotal:</Text>
              </Column>
              <Column style={summaryValueCol}>
                <Text style={summaryValue}>${orderData.subtotal.toFixed(2)}</Text>
              </Column>
            </Row>
            <Row style={summaryRow}>
              <Column>
                <Text style={summaryLabel}>Shipping:</Text>
              </Column>
              <Column style={summaryValueCol}>
                <Text style={summaryValue}>${orderData.shipping.toFixed(2)}</Text>
              </Column>
            </Row>
            <Row style={summaryRow}>
              <Column>
                <Text style={summaryLabel}>Tax:</Text>
              </Column>
              <Column style={summaryValueCol}>
                <Text style={summaryValue}>${orderData.tax.toFixed(2)}</Text>
              </Column>
            </Row>
            <Row style={totalRow}>
              <Column>
                <Text style={totalLabel}>Total:</Text>
              </Column>
              <Column style={summaryValueCol}>
                <Text style={totalValue}>${orderData.total.toFixed(2)}</Text>
              </Column>
            </Row>
          </Section>

          {/* Shipping Address */}
          <Section style={section}>
            <Heading as="h3" style={h3}>
              Shipping Address
            </Heading>
            <Text style={address}>
              {orderData.shippingAddress.street}<br />
              {orderData.shippingAddress.city}, {orderData.shippingAddress.state} {orderData.shippingAddress.zipCode}<br />
              {orderData.shippingAddress.country}
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Questions about your order? Reply to this email or contact our support team.
            </Text>
            <Text style={footerText}>
              Thank you for choosing Voltique!
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const header = {
  textAlign: 'center' as const,
  padding: '32px 0',
  borderBottom: '1px solid #e6ebf1',
};

const h1 = {
  color: '#f97316', // Orange-500
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0',
  padding: '0',
};

const tagline = {
  color: '#64748b',
  fontSize: '14px',
  margin: '8px 0 0',
};

const section = {
  padding: '24px 32px',
};

const h2 = {
  color: '#1e293b',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 16px',
};

const h3 = {
  color: '#1e293b',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 12px',
};

const text = {
  color: '#64748b',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const orderInfo = {
  backgroundColor: '#f1f5f9',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
};

const orderNumber = {
  color: '#1e293b',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 8px',
};

const delivery = {
  color: '#64748b',
  fontSize: '14px',
  margin: '0',
};

const itemRow = {
  borderBottom: '1px solid #e2e8f0',
  padding: '12px 0',
};

const itemImageCol = {
  width: '60px',
  verticalAlign: 'top' as const,
};

const itemImage = {
  width: '50px',
  height: '50px',
  borderRadius: '4px',
  objectFit: 'cover' as const,
};

const itemDetailsCol = {
  paddingLeft: '16px',
  verticalAlign: 'top' as const,
};

const itemName = {
  color: '#1e293b',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 4px',
};

const itemDetails = {
  color: '#64748b',
  fontSize: '14px',
  margin: '0',
};

const itemPriceCol = {
  textAlign: 'right' as const,
  verticalAlign: 'top' as const,
  width: '80px',
};

const itemPrice = {
  color: '#1e293b',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0',
};

const summary = {
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 32px',
};

const summaryRow = {
  padding: '4px 0',
};

const summaryLabel = {
  color: '#64748b',
  fontSize: '14px',
  margin: '0',
};

const summaryValueCol = {
  textAlign: 'right' as const,
};

const summaryValue = {
  color: '#1e293b',
  fontSize: '14px',
  margin: '0',
};

const totalRow = {
  borderTop: '2px solid #e2e8f0',
  padding: '12px 0 0',
  margin: '12px 0 0',
};

const totalLabel = {
  color: '#1e293b',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0',
};

const totalValue = {
  color: '#f97316',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0',
};

const address = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const footer = {
  textAlign: 'center' as const,
  padding: '32px 32px 0',
  borderTop: '1px solid #e6ebf1',
};

const footerText = {
  color: '#64748b',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '0 0 8px',
};

export default OrderConfirmationEmail;

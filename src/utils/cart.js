import { paymentMethodConstant } from '../constants'

export const addItem = (item, cartItems = []) => {
  cartItems = JSON.parse(JSON.stringify(cartItems ?? []))

  let itemAdded = false
  cartItems.map((cartItem, cartItemKey) => {
    if (
      !itemAdded &&
      parseInt(cartItems[cartItemKey]['dishId']) === parseInt(item['dishId'])
    ) {
      if (
        JSON.stringify(cartItems[cartItemKey]['options']) ===
        JSON.stringify(item['options'])
      ) {
        cartItems[cartItemKey]['quantity'] += parseInt(item['quantity'])
        cartItems[cartItemKey]['price'] =
          cartItems[cartItemKey]['quantity'] * parseFloat(item['unit_price'])
        cartItems[cartItemKey]['actual_price'] =
          cartItems[cartItemKey]['quantity'] *
          parseFloat(item['actual_unit_price'])

        cartItems[cartItemKey]['stock'] = parseInt(item['stock'])
        cartItems[cartItemKey]['max_stock_allowed'] = parseInt(
          item['max_stock_allowed']
        )

        itemAdded = true
      }
    }
  })

  if (!itemAdded) {
    let details = []
    details.push(item['name'])
    item['desc'] && details.push(item['desc'])

    let unit_price = parseFloat(item['unit_price'])
    let actual_unit_price = parseFloat(item['actual_unit_price'])

    ;(item['options'] ?? []).forEach((option) => {
      let suboption_names = []

      ;(option.suboptions_data ?? []).forEach((suboption) => {
        suboption_names.push(suboption.name)

        unit_price += parseFloat(suboption.price ?? 0)
        actual_unit_price += parseFloat(suboption.actual_price ?? 0)
      })

      details.push(`${option.name}: ${suboption_names.join(', ')}`)
    })

    const cartItem = {
      quantity: item['quantity'],
      //
      dishId: item['dishId'],
      img_url: item['img_url'],
      name: item['name'],
      desc: item['desc'],
      details: details.join('~'),
      //
      unit_price,
      actual_unit_price,
      //
      price: item['quantity'] * parseFloat(unit_price),
      actual_price: item['quantity'] * parseFloat(actual_unit_price),
      //
      options: item['options'],
      //
      stock: parseInt(item['stock']),
      max_stock_allowed: parseInt(item['max_stock_allowed'])
    }

    cartItems.push(cartItem)
  }

  return cartItems
}

export const removeItem = (index, cartItems = []) => {
  cartItems = JSON.parse(JSON.stringify(cartItems ?? []))

  cartItems.splice(index, 1)
  // cartItems = cartItems.filter(
  //   (cartItem, cartItemKey) => (cartItems[cartItemKey]["index"] ?? 0) != index
  // );

  return cartItems
}

export const updateItemQuantity = (quantity, index, cartItems = []) => {
  cartItems = JSON.parse(JSON.stringify(cartItems ?? []))

  cartItems[index]['quantity'] = parseInt(quantity)
  // cartItems.map((cartItem, cartItemKey) => {
  //   if ((cartItems[cartItemKey]["index"] ?? 0) == index) {
  //     cartItems[cartItemKey]["quantity"] = parseInt(quantity);
  //   }
  // });

  return cartItems
}

export const applyPromo = (promoResponse, cartData, t) => {
  let discount = 0
  let dishes = []
  let message = promoResponse.msg ?? ''

  if (promoResponse.data.min_order_amount > cartData.subTotal) {
    return {
      message: t('min_order_must_be_greater_than_amount', {
        amount: promoResponse.data.min_order_amount
      }),
      discount: 0,
      cashback: 0,
      dishes: []
    }
  }

  if (promoResponse.data.discount_price > 0) {
    discount = promoResponse.data.discount_price
  }

  if (promoResponse.data.discount_percent > 0) {
    discount = (promoResponse.data.discount_percent * cartData.subTotal) / 100
  }

  if (
    promoResponse.data.max_discount_amount > 0 &&
    promoResponse.data.max_discount_amount < discount
  ) {
    discount = promoResponse.data.max_discount_amount
  }

  if (promoResponse.data.dishes.length > 0) {
    dishes = promoResponse.data.dishes ?? []
  }

  if (promoResponse.data.promo_type == 1) {
    return { message, discount: 0, cashback: discount, dishes }
  } else {
    return { message, discount, cashback: 0, dishes }
  }
}

export const calculateTotal = (
  cartItems = [],
  cartTax = 0,
  cartDeliveryCharges = 0,
  deliveryChargesThreshold = 0,
  fbr_pos_charges = 0
) => {
  cartItems = JSON.parse(JSON.stringify(cartItems ?? []))

  let cart = {
    items: [],
    quantity: 0,
    subTotal: 0,
    actual_subTotal: 0,
    total: 0,
    tax: parseFloat(cartTax),
    tax_amount: 0,
    delivery_charges: parseFloat(cartDeliveryCharges),
    delivery_charges_threshold: parseFloat(deliveryChargesThreshold),
    fbr_pos_charges: parseFloat(fbr_pos_charges)
  }

  cartItems.map((cartItem, cartItemIndex) => {
    cart['quantity'] += cartItem['quantity']
    // cartItem["sectionid"] = section.id;
    cartItem['selectedSubOptionsIds'] = []
    cartItem['name'] = cartItem['name']
    cartItem['descr'] = cartItem['desc']
    cartItem['details'] = cartItem['details']

    cartItem['actual_price'] = parseFloat(cartItem['actual_unit_price'])
    cartItem['price'] = parseFloat(cartItem['unit_price'])

    cartItem['options'].map((cartItemOption) => {
      cartItemOption['suboptions_data'].map((cartItemSubOption) => {
        cartItem['selectedSubOptionsIds'].push(cartItemSubOption.id)
        cartItem['actual_price'] += parseFloat(cartItemSubOption.actual_price)
        cartItem['price'] += parseFloat(cartItemSubOption.price)
      })
    })

    cartItem['selectedSubOptionsIds'] = JSON.stringify(
      cartItem['selectedSubOptionsIds']
    ).replaceAll(' ', '')

    cartItem['actual_price'] =
      cartItem['quantity'] *
      parseFloat(cartItem['actual_unit_price']).toFixed(2)
    cartItem['price'] =
      cartItem['quantity'] * parseFloat(cartItem['unit_price']).toFixed(2)

    cart['actual_subTotal'] += cartItem['actual_price']
    cart['subTotal'] += cartItem['price']
  })

  const deliveryCharges =
    cart['delivery_charges_threshold'] != 0 &&
    cart['delivery_charges_threshold'] <= cart['subTotal']
      ? 0
      : cart['delivery_charges']

  cart['items'] = cartItems
  cart['delivery_charges'] = deliveryCharges
  cart['tax_amount'] = (cart['tax'] * cart['actual_subTotal']) / 100
  cart['total'] = cart['subTotal']
  cart['total'] += cart['tax_amount']
  cart['total'] += cart['delivery_charges']
  cart['total'] += cart['fbr_pos_charges']

  cart['tax_amount'] = parseFloat(cart['tax_amount']).toFixed(2)
  cart['subTotal'] = parseFloat(cart['subTotal']).toFixed(2)
  cart['delivery_charges'] = parseFloat(cart['delivery_charges']).toFixed(2)
  cart['fbr_pos_charges'] = parseFloat(cart['fbr_pos_charges']).toFixed(2)
  cart['total'] = parseFloat(cart['total']).toFixed(2)

  return cart
}

export const parseOrderDetails = (cartItems = []) => {
  cartItems = JSON.parse(JSON.stringify(cartItems ?? []))

  let orderDetails = []

  cartItems.map((cartItem) => {
    let orderDetail = {}
    orderDetail['quantity'] = cartItem['quantity']
    orderDetail['dishId'] = cartItem['dishId']
    orderDetail['dishName'] = cartItem['name'] ?? ''
    orderDetail['descr'] = cartItem['desc'] ?? ''
    orderDetail['details'] = cartItem['details'] ?? orderDetail['descr']
    orderDetail['selectedSubOptionsIds'] = []
    //
    orderDetail['actual_price'] = parseFloat(cartItem['actual_price']).toFixed(
      2
    )
    orderDetail['price'] = parseFloat(cartItem['price']).toFixed(2)
    //
    ;(cartItem['options'] ?? []).map((cartIO) => {
      ;(cartIO['suboptions_data'] ?? []).map((cartISO) => {
        orderDetail['selectedSubOptionsIds'].push(cartISO.id)
      })
    })

    orderDetail['selectedSubOptionsIds'] = JSON.stringify(
      orderDetail['selectedSubOptionsIds']
    ).replaceAll(' ', '')

    orderDetails.push(orderDetail)
  })

  return orderDetails
}

export const parseCartApiResponse = (
  items = [],
  cartItems = [],
  cartTax = 0,
  cartDeliveryCharges = 0,
  deliveryChargesThreshold = 0,
  fbr_pos_charges = 0
) => {
  items = JSON.parse(JSON.stringify(items ?? []))
  cartItems = JSON.parse(JSON.stringify(cartItems ?? []))

  let cart = {
    items: [],
    quantity: 0,
    subTotal: 0,
    actual_subTotal: 0,
    total: 0,
    tax: parseFloat(cartTax),
    tax_amount: 0,
    delivery_charges: parseFloat(cartDeliveryCharges),
    delivery_charges_threshold: parseFloat(deliveryChargesThreshold),
    fbr_pos_charges: parseFloat(fbr_pos_charges)
  }

  cartItems.map((cartItem, index) => {
    cart['quantity'] += cartItem['quantity']
    // cartItem["sectionid"] = section.id;
    cartItem['selectedSubOptionsIds'] = []
    cartItem['name'] = cartItem['name']
    cartItem['descr'] = cartItem['desc']
    cartItem['details'] = cartItem['details']

    cartItem['actual_unit_price'] = parseFloat(items[index]['actual_price'])
    cartItem['unit_price'] = parseFloat(items[index]['unit_price'])

    cartItem['actual_price'] =
      parseInt(cartItem['quantity']) * parseFloat(items[index]['actual_price'])
    cartItem['price'] =
      parseInt(cartItem['quantity']) * parseFloat(items[index]['unit_price'])

    cartItem['selectedSubOptionsIds'] = JSON.stringify(
      items[index]['sub_option_array']
    ).replaceAll(' ', '')

    cart['actual_subTotal'] =
      parseFloat(cart['actual_subTotal']) + parseFloat(cartItem['actual_price'])
    cart['subTotal'] =
      parseFloat(cart['subTotal']) + parseFloat(cartItem['price'])
  })

  const deliveryCharges =
    cart['delivery_charges_threshold'] != 0 &&
    cart['delivery_charges_threshold'] <= cart['subTotal']
      ? 0
      : cart['delivery_charges']

  cart['items'] = cartItems
  cart['delivery_charges'] = deliveryCharges
  cart['tax_amount'] = (cart['tax'] * cart['actual_subTotal']) / 100
  cart['total'] = cart['subTotal']
  cart['total'] += cart['tax_amount']
  cart['total'] += cart['delivery_charges']
  cart['total'] += cart['fbr_pos_charges']

  cart['tax_amount'] = parseFloat(cart['tax_amount']).toFixed(2)
  cart['subTotal'] = parseFloat(cart['subTotal']).toFixed(2)
  cart['delivery_charges'] = parseFloat(cart['delivery_charges']).toFixed(2)
  cart['fbr_pos_charges'] = parseFloat(cart['fbr_pos_charges']).toFixed(2)
  cart['total'] = parseFloat(cart['total']).toFixed(2)

  return cart
}

export const getTaxFromBranchData = (
  branchData = null,
  paymentMethod = paymentMethodConstant.cod.type
) => {
  const rest_branch = branchData
    ? branchData.data.restaurant_branches.length > 0
      ? branchData.data.restaurant_branches[0]
      : null
    : null

  let tax = rest_branch
    ? paymentMethod == paymentMethodConstant.cod.type
      ? rest_branch.tax_percentage
      : parseFloat(rest_branch.tax_percentage_online) > 0
      ? rest_branch.tax_percentage_online
      : rest_branch.tax_percentage
    : 0

  if (tax == 0) {
    tax = branchData?.data?.tax ?? 0
  }

  return tax
}

export const getCartItemVariationsByProductId = (cartItems = [], productId) => {
  let items = []
  let quantity = 0

  cartItems.forEach((cartItem, cartItemIndex) => {
    if (cartItem['dishId'] == productId) {
      quantity += cartItem['quantity']
      items.push({ cartItemIndex, cartItem })
    }
  })

  return { items, quantity }
}

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, registerCarrierSchema.parse)
  const passwordHash = await hashUserPassword(body.password)

  try {
    const user = await db.transaction(async (tx) => {
      const [company] = await tx.insert(companies).values({
        name: body.companyName,
        contactEmail: body.email,
        contactPhone: body.contactPhone ?? null,
        mcNumber: body.mcNumber ?? null,
        address: body.address ?? null,
        status: 'pending',
      }).returning()

      const [admin] = await tx.insert(users).values({
        email: body.email,
        passwordHash,
        name: body.name,
        phone: body.phone ?? null,
        role: 'carrier_admin',
        companyId: company!.id,
      }).returning()
      return admin!
    })

    await setUserSession(event, { user: toSessionUser(user) })
    return { user: toPublicUser(user) }
  }
  catch (err) {
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
    }
    throw err
  }
})

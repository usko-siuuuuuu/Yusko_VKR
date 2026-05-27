import { createContext, useContext, useState } from 'react'

const ObjectContext = createContext(null)

export function ObjectProvider({ children }) {
  const [currentObject, setCurrentObject] = useState(null)

  return (
    <ObjectContext.Provider value={{ currentObject, setCurrentObject }}>
      {children}
    </ObjectContext.Provider>
  )
}

export const useObject = () => useContext(ObjectContext)